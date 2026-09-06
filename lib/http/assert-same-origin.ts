import { ApiError } from "./api-error-response";

export function assertSameOrigin(request: Request) {
  const expectedOrigin = process.env.APP_ORIGIN;

  if (!expectedOrigin) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError("Konfigurasi origin aplikasi belum tersedia.", 500);
    }
    return;
  }

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    origin !== expectedOrigin ||
    (fetchSite !== null && fetchSite !== "same-origin")
  ) {
    throw new ApiError("Request origin tidak diizinkan.", 403);
  }
}
