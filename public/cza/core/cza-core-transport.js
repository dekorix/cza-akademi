/*
 * CZA Core Transport v1.0.0
 * Canonical öğrenme kayıtlarını aynı origin'deki /api/core geçidine taşır.
 */

class CzaTransportError extends Error {
  constructor(code, { status = 0, retryable = false } = {}) {
    super(code);
    this.name = "CzaTransportError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function requireText(value, code, maxLength = 160) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    throw new CzaTransportError(code);
  }

  return value.trim();
}

async function readResponseBody(response) {
  const contentType = response.headers?.get?.("content-type") ?? "";

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text ? { message: text.slice(0, 500) } : null;
  } catch {
    return null;
  }
}

class CzaCoreTransportAdapter {
  constructor({
    endpoint = "/api/core",
    contractVersion,
    timeoutMs = 15000,
    fetchImpl = globalThis.fetch
  } = {}) {
    this.endpoint = requireText(endpoint, "cza_transport_endpoint_required", 500);
    this.contractVersion = requireText(
      contractVersion,
      "cza_transport_contract_version_required",
      40
    );

    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
      throw new CzaTransportError("cza_transport_timeout_invalid");
    }

    if (typeof fetchImpl !== "function") {
      throw new CzaTransportError("cza_transport_fetch_unavailable");
    }

    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async publish(record) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "accept": "application/json",
          "x-cza-contract-version": this.contractVersion
        },
        body: JSON.stringify({
          action: "module_record",
          record
        }),
        signal: controller.signal
      });

      const body = await readResponseBody(response);

      if (!response.ok) {
        const code = typeof body?.error === "string"
          ? body.error
          : typeof body?.code === "string"
            ? body.code
            : "cza_transport_request_failed";

        throw new CzaTransportError(code, {
          status: response.status,
          retryable: response.status === 408 || response.status === 429 || response.status >= 500
        });
      }

      return Object.freeze({
        ok: true,
        status: response.status,
        data: body
      });
    } catch (error) {
      if (error instanceof CzaTransportError) {
        throw error;
      }

      if (error?.name === "AbortError") {
        throw new CzaTransportError("cza_transport_timeout", {
          retryable: true
        });
      }

      throw new CzaTransportError("cza_transport_network_error", {
        retryable: true
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export {
  CzaTransportError,
  CzaCoreTransportAdapter
};
