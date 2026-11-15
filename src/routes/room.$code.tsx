import { createFileRoute, redirect } from "@tanstack/react-router";

// English alias for invite links: /room/CODE opens the same room entrance as /sala/CODE.
export const Route = createFileRoute("/room/$code")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/sala/$code", params: { code: params.code }, replace: true });
  },
});
