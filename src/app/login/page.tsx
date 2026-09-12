import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { LoginButton } from "./login-button";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  if (await getSession()) redirect("/dashboard");
  const { next } = await searchParams;
  const target = safeNext(next);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            <div className="flex flex-col justify-center p-6 md:p-10">
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <Image
                    src="/logo.png"
                    alt=""
                    width={56}
                    height={56}
                    priority
                    className="size-14"
                  />
                  <h1 className="text-2xl font-bold">Đời Sống Xanh</h1>
                  <p className="text-balance text-muted-foreground">
                    Cổng quản lý công việc dành cho quản lý.
                  </p>
                </div>
                <Field>
                  <LoginButton next={target} />
                </Field>
                <FieldDescription className="text-center">
                  Chỉ các tài khoản Google được cấp quyền mới đăng nhập được.
                </FieldDescription>
              </FieldGroup>
            </div>
            <div className="relative hidden min-h-[420px] md:block">
              <Image
                src="/logincover.png"
                alt=""
                fill
                priority
                sizes="(min-width: 768px) 448px, 100vw"
                className="object-cover object-top dark:brightness-[0.75]"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

/**
 * `?next=` is attacker-controllable and ends up as the post-login redirect,
 * so only same-site absolute paths are allowed. `//evil.com` is protocol
 * relative and would leave the site, hence the second check.
 */
function safeNext(next: string | string[] | undefined): string {
  const fallback = "/dashboard";
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next === "/" ? fallback : next;
}
