export default async function globalTeardown() {
  await globalThis.__stopTestDatabase__?.();
}
