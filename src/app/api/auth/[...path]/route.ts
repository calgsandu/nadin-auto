import { auth } from "@/lib/auth/server";

const handlers = auth.handler();

export const GET = handlers.GET;

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (path.join("/") === "sign-up/email") {
    return Response.json(
      { error: "Înregistrarea publică este dezactivată." },
      { status: 403 },
    );
  }
  return handlers.POST(request, context);
}
