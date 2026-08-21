/**
 * How two devices find each other.
 *
 * STUN alone is enough on most home and campus networks: the devices connect
 * directly and no video touches anyone's server. Some networks — mobile data,
 * locked-down office wifi — refuse that, so a relay is offered as a fallback.
 * The relay is only used when a direct route genuinely cannot be established.
 *
 * Ports 80 and 443 over TCP are included deliberately: they are the ones that
 * survive restrictive firewalls.
 *
 * Set CADENCE_TURN_URL / _USER / _PASS to use your own relay instead.
 */
export function iceServers(): RTCIceServer[] {
  const stun: RTCIceServer = {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun.cloudflare.com:3478",
    ],
  };

  const url = process.env.CADENCE_TURN_URL?.trim();
  if (url) {
    return [
      stun,
      {
        urls: url.split(",").map((u) => u.trim()).filter(Boolean),
        username: process.env.CADENCE_TURN_USER ?? "",
        credential: process.env.CADENCE_TURN_PASS ?? "",
      },
    ];
  }

  // Open Relay's public relay: free, no account, and the credentials are
  // published for exactly this use.
  return [
    stun,
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];
}
