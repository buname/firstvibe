"use client";

import type { ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export default function JournalDndProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}
