import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext } from "@/interface/http/session";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicOrg, publicUser } from "@/interface/http/serializers";

export const runtime = "nodejs";

const postSchema = z.object({
  skip: z.boolean().optional(),
  source: z.string().max(80).optional(),
  clientType: z.string().max(80).optional(),
  heardAbout: z.string().max(120).optional(),
  intendedUse: z.string().max(200).optional(),
  companyRole: z.string().max(80).optional(),
  companySize: z.string().max(40).optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user).catch(() => null);
    const org = ctx?.org;

    const status =
      org?.onboardingCompletedAt
        ? "completed"
        : user.onboardingSkippedAt
          ? "skipped"
          : "pending";

    return ok({
      status,
      user: publicUser(user),
      organization: org && ctx ? publicOrg(org, ctx.membership) : null,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return error(422, "Datos inválidos", "unprocessable", parsed.error.flatten());
    }

    if (parsed.data.skip) {
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingSkippedAt: new Date() },
      });
      return ok({ status: "skipped" });
    }

    const ctx = await resolveOrgContext(req, user);
    const data = parsed.data;

    await prisma.organization.update({
      where: { id: ctx.org.id },
      data: {
        source: data.source ?? ctx.org.source,
        clientType: data.clientType ?? ctx.org.clientType,
        heardAbout: data.heardAbout ?? ctx.org.heardAbout,
        intendedUse: data.intendedUse ?? ctx.org.intendedUse,
        companyRole: data.companyRole ?? ctx.org.companyRole,
        companySize: data.companySize ?? ctx.org.companySize,
        onboardingCompletedAt: new Date(),
      },
    });

    const refreshed = await prisma.organization.findUniqueOrThrow({
      where: { id: ctx.org.id },
    });

    return ok({
      status: "completed",
      organization: publicOrg(refreshed, ctx.membership),
    });
  } catch (err) {
    return handleError(err);
  }
}
