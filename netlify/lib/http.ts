export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) return json({ error: err.code, message: err.message }, err.status)
  console.error(err)
  return json({ error: 'internal_error', message: 'Error interno del servidor.' }, 500)
}
