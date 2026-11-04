import { createContext } from "react-router";
import type { Actor } from "~/domain/permissions";

export const cloudflareContext = createContext<{ env: Env; ctx: ExecutionContext }>();

/** Signed-in, active user for this request (null for visitors). Set by root middleware. */
export const actorContext = createContext<Actor | null>(null);
