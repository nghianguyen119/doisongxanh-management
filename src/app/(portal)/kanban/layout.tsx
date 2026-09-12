/**
 * The kanban segment owns the intercepted task modal: only navigations that
 * start on the board open `/tasks/[id]` in the dialog. Elsewhere (task table,
 * post-create redirect) the standalone task page renders as usual.
 */
export default function KanbanLayout({
  children,
  modal,
}: LayoutProps<"/kanban">) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
