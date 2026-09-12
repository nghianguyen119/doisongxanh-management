import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { getZaloClient } from "@/lib/zalo/factory";
import { ONBOARDING_TASK, copy } from "./bot-copy";
import { createTask } from "./task-service";

/**
 * After an employee links their Zalo account, send them a short guide and one
 * practice task so they can try every button without touching real work.
 *
 * Best-effort by design: linking must succeed even when Zalo delivery or task
 * creation fails. `employee.onboardedAt` makes it exactly-once per employee
 * (failing halfway retries on the next link event).
 */
export async function onboardEmployee(employeeId: string): Promise<void> {
  const emp = await db.query.employee.findFirst({
    where: eq(employee.id, employeeId),
  });
  if (!emp || emp.onboardedAt) return;

  try {
    if (emp.zaloUserId) {
      await getZaloClient().sendText(emp.zaloUserId, copy.onboardingGuide);
    }

    await createTask({
      title: ONBOARDING_TASK.title,
      description: ONBOARDING_TASK.description,
      priority: "normal",
      dueAt: null,
      assigneeId: emp.id,
      createdBy: null,
    });

    await db
      .update(employee)
      .set({ onboardedAt: new Date() })
      .where(eq(employee.id, emp.id));
  } catch (err) {
    console.error(`[zalo:onboarding] failed employee=${emp.id}`, err);
  }
}
