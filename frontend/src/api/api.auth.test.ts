import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from "axios";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const originalAdapter = axios.defaults.adapter;

function response<T>(config: Parameters<AxiosAdapter>[0], data: T, status = 200): AxiosResponse<T> {
  return {
    config,
    data,
    headers: {},
    status,
    statusText: status === 200 ? "OK" : "Unauthorized",
  };
}

describe("Axios session refresh integration", () => {
  beforeAll(async () => {
    await import("./api");
  });

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    localStorage.clear();
  });

  it("refreshes an expired access token and retries the original request", async () => {
    localStorage.setItem("currentUser", JSON.stringify({
      id: 4,
      role: "student",
      access: "expired-access",
      refresh: "valid-refresh",
    }));
    const requestedAuthorizations: Array<string | undefined> = [];
    let refreshRequests = 0;

    axios.defaults.adapter = async (config) => {
      const authorizationHeader = config.headers.get("Authorization");
      const authorization =
        typeof authorizationHeader === "string" ? authorizationHeader : undefined;
      if (config.url?.endsWith("/auth/refresh")) {
        refreshRequests += 1;
        expect(authorization).toBeUndefined();
        return response(config, { access: "new-access" });
      }

      requestedAuthorizations.push(authorization);
      if (authorization === "Bearer expired-access") {
        const unauthorized = response(config, { detail: "Token expired" }, 401);
        throw new AxiosError(
          "Unauthorized",
          AxiosError.ERR_BAD_REQUEST,
          config,
          undefined,
          unauthorized,
        );
      }
      return response(config, { ok: true });
    };

    const { fetchCourseDetail } = await import("./api");
    const result = await fetchCourseDetail(1);

    expect(result).toEqual({ ok: true });
    expect(refreshRequests).toBe(1);
    expect(requestedAuthorizations).toEqual([
      "Bearer expired-access",
      "Bearer new-access",
    ]);
    expect(JSON.parse(localStorage.getItem("currentUser") || "{}").access).toBe("new-access");
  });

  it("clears the session when the refresh token is rejected", async () => {
    localStorage.setItem("currentUser", JSON.stringify({
      id: 4,
      role: "student",
      access: "expired-access",
      refresh: "expired-refresh",
    }));
    axios.defaults.adapter = async (config) => {
      const unauthorized = response(config, { detail: "Token expired" }, 401);
      throw new AxiosError(
        "Unauthorized",
        AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        unauthorized,
      );
    };

    const { fetchCourseDetail } = await import("./api");
    await expect(fetchCourseDetail(1)).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(localStorage.getItem("currentUser")).toBeNull();
  });
});
