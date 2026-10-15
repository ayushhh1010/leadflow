// Runs before the test workers start, so they all inherit the timezone.
// UTC+5:30 with no DST: local midnight is 18:30 UTC, which keeps day-boundary bugs visible.
export default function setup() {
  process.env.TZ = "Asia/Kolkata";
}
