export async function bootstrap(): Promise<void> {
  await import('./application');
}

