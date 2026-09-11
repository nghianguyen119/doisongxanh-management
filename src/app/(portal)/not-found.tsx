import { LinkButton } from "@/components/ui";

export default function PortalNotFound() {
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="text-3xl">🔎</div>
      <h2 className="mt-2 font-semibold">Không tìm thấy</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nội dung bạn tìm không tồn tại hoặc đã bị xoá.
      </p>
      <div className="mt-4">
        <LinkButton href="/dashboard">Về trang tổng quan</LinkButton>
      </div>
    </div>
  );
}
