// Direct phone-to-phone link over a WebRTC data channel, with no signalling server: the two phones
// swap their connection descriptions by hand, as QR codes or pasted links. WebRTC encrypts the
// channel itself (DTLS), so the conversation travels only between the two phones.
//
// The one outside contact is STUN: each phone asks a public server what its own address looks like
// from outside. Those servers see an IP address, never the conversation. On the same Wi-Fi the link
// usually forms from local addresses alone; across mobile networks it can fail outright, because
// there is deliberately no relay (TURN) to fall back on.

export const STUN_SERVERS = ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478']

/** Waiting longer rarely finds a better route, and the person is standing there holding a phone. */
const ICE_GATHER_TIMEOUT_MS = 4000
const CHANNEL_LABEL = 'haven'
const CODE_VERSION = 1

type CodeKind = 'offer' | 'answer'

interface CodePayload {
  v: number
  k: CodeKind
  sdp: string
}

// ---------- encoding ----------
// Descriptions are compressed so the QR code stays coarse enough to scan off another phone's screen.

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

export async function encodeCode(kind: CodeKind, sdp: string): Promise<string> {
  const json = JSON.stringify({ v: CODE_VERSION, k: kind, sdp } satisfies CodePayload)
  return toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')))
}

/**
 * Accepts the bare code or anything containing it — a full join link, or text pasted from a message
 * with words around it. Throws a readable error for anything else.
 */
export async function decodeCode(input: string, expected: CodeKind): Promise<string> {
  const match = input.match(/(?:#join=)?([A-Za-z0-9_-]{40,})/)
  if (!match) throw new Error("That doesn't look like a Haven session code.")
  let payload: CodePayload
  try {
    const json = new TextDecoder().decode(await pipe(fromBase64Url(match[1]), new DecompressionStream('deflate-raw')))
    payload = JSON.parse(json)
  } catch {
    throw new Error("That code couldn't be read. It may have been cut off — try scanning it again.")
  }
  if (payload.v !== CODE_VERSION) throw new Error('That code is from a different version of Haven. Reload both phones.')
  if (payload.k !== expected) {
    throw new Error(
      expected === 'answer'
        ? "That's a session invitation, not a reply. Scan the code shown on the other phone after it joined."
        : "That's a reply code. The other phone needs to scan it, not this one.",
    )
  }
  return payload.sdp
}

export function joinLink(offerCode: string): string {
  return `${window.location.origin}${window.location.pathname}#join=${offerCode}`
}

// ---------- connection ----------

/** Every candidate goes into one description, since there's no channel to trickle more later. */
function gatherComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check)
      clearTimeout(timer)
      resolve()
    }
    const check = () => {
      if (pc.iceGatheringState === 'complete') done()
    }
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS)
    pc.addEventListener('icegatheringstatechange', check)
  })
}

/** What kinds of address a description offers — the first thing to look at when phones won't connect. */
export function summarizeCandidates(sdp: string | undefined): string {
  if (!sdp) return 'none yet'
  const counts = { local: 0, hiddenLocal: 0, public: 0, relay: 0, tcp: 0 }
  for (const line of sdp.split(/\r?\n/)) {
    if (!line.startsWith('a=candidate:')) continue
    const parts = line.split(' ')
    const address = parts[4] ?? ''
    const type = parts[parts.indexOf('typ') + 1]
    if (parts[2]?.toLowerCase() === 'tcp') counts.tcp++
    else if (type === 'host') {
      if (address.endsWith('.local')) counts.hiddenLocal++
      else counts.local++
    } else if (type === 'srflx' || type === 'prflx') counts.public++
    else if (type === 'relay') counts.relay++
  }
  return `${counts.local} local, ${counts.hiddenLocal} hidden-local (mDNS), ${counts.public} public (STUN)${
    counts.tcp ? `, ${counts.tcp} tcp` : ''
  }`
}

export class PeerLink {
  onMessage: ((message: unknown) => void) | null = null
  onOpen: (() => void) | null = null
  onClose: (() => void) | null = null
  private channel: RTCDataChannel | null = null
  private closed = false
  private opened = false
  private readonly started = performance.now()
  private readonly timeline: string[] = []
  readonly pc: RTCPeerConnection

  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_SERVERS }] })
    this.pc.addEventListener('connectionstatechange', () => {
      const state = this.pc.connectionState
      this.note(`connection ${state}`)
      if (state === 'closed') this.handleClose()
      // Before the channel has ever opened, "failed" isn't final: the other phone may simply not have
      // scanned the reply yet, and the link can still form once it does. The pairing timeout decides.
      else if (state === 'failed' && this.opened) this.handleClose()
    })
    this.pc.addEventListener('iceconnectionstatechange', () => this.note(`ice ${this.pc.iceConnectionState}`))
    this.pc.addEventListener('icegatheringstatechange', () => this.note(`gathering ${this.pc.iceGatheringState}`))
  }

  private note(event: string) {
    this.timeline.push(`${((performance.now() - this.started) / 1000).toFixed(1)}s ${event}`)
  }

  attach(channel: RTCDataChannel) {
    this.channel = channel
    channel.addEventListener('open', () => {
      this.opened = true
      this.note('channel open')
      this.onOpen?.()
    })
    channel.addEventListener('close', () => {
      this.note('channel closed')
      this.handleClose()
    })
    channel.addEventListener('message', (e) => {
      try {
        this.onMessage?.(JSON.parse(e.data))
      } catch {
        // not one of ours — ignore it rather than tear the session down
      }
    })
  }

  get isOpen(): boolean {
    return this.channel?.readyState === 'open'
  }

  send(message: unknown) {
    if (this.isOpen) this.channel!.send(JSON.stringify(message))
  }

  close() {
    this.channel?.close()
    this.pc.close()
    this.handleClose()
  }

  /**
   * Plain-text troubleshooting report. iPhone browsers have no developer tools, so this is the only
   * way to see why two phones didn't connect. Addresses are summarized, never included.
   */
  diagnostics(role: string): string {
    return [
      `This phone: ${role}`,
      `This phone offered: ${summarizeCandidates(this.pc.localDescription?.sdp)}`,
      `Other phone offered: ${summarizeCandidates(this.pc.remoteDescription?.sdp)}`,
      `Now: connection ${this.pc.connectionState}, ice ${this.pc.iceConnectionState}, channel ${this.channel?.readyState ?? 'none'}`,
      'Timeline:',
      ...this.timeline.map((t) => `  ${t}`),
    ].join('\n')
  }

  private handleClose() {
    if (this.closed) return
    this.closed = true
    this.onClose?.()
  }
}

/**
 * Safari only reveals a phone's real local addresses to a page while it is capturing from the camera
 * or microphone; otherwise it substitutes hidden ".local" names that some Wi-Fi networks can't
 * resolve. So the camera is held open while the connection description is gathered, then released.
 * Denied or unavailable is fine — the link may still form.
 */
async function holdCamera(): Promise<() => void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    return () => stream.getTracks().forEach((t) => t.stop())
  } catch {
    return () => {}
  }
}

/** Host side, step one: returns the link plus the code to show as a QR. */
export async function createOffer(): Promise<{ link: PeerLink; code: string }> {
  const release = await holdCamera()
  try {
    const link = new PeerLink()
    link.attach(link.pc.createDataChannel(CHANNEL_LABEL, { ordered: true }))
    await link.pc.setLocalDescription(await link.pc.createOffer())
    await gatherComplete(link.pc)
    return { link, code: await encodeCode('offer', link.pc.localDescription!.sdp) }
  } finally {
    release()
  }
}

/** Guest side: takes the host's code, returns the reply code for the host to scan. */
export async function answerOffer(offerInput: string): Promise<{ link: PeerLink; code: string }> {
  const sdp = await decodeCode(offerInput, 'offer')
  const release = await holdCamera()
  try {
    const link = new PeerLink()
    link.pc.addEventListener('datachannel', (e) => link.attach(e.channel))
    await link.pc.setRemoteDescription({ type: 'offer', sdp })
    await link.pc.setLocalDescription(await link.pc.createAnswer())
    await gatherComplete(link.pc)
    return { link, code: await encodeCode('answer', link.pc.localDescription!.sdp) }
  } finally {
    release()
  }
}

/** Host side, step two: completes the link with the guest's reply code. */
export async function acceptAnswer(link: PeerLink, answerInput: string): Promise<void> {
  const sdp = await decodeCode(answerInput, 'answer')
  await link.pc.setRemoteDescription({ type: 'answer', sdp })
}
