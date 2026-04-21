"use client";

/**
 * ApiAuthSync
 *
 * Wires the Clerk session token into the reviewflow-api module so that every
 * API call automatically carries an Authorization: Bearer header.
 *
 * Renders nothing — place this once inside the authenticated layout.
 */

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setTokenGetter } from "@/lib/reviewflow-api";

export function ApiAuthSync() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  return null;
}
