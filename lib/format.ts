export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "just now";
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);

  if (sec < 10) return "just now";
  if (sec < 60) return `${sec} seconds ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;

  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

export function truncateAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 2) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}
