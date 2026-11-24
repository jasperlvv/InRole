"use client";
import Image from "next/image";
import { useState } from "react";
import type { Person } from "@/lib/demo-data";
import { personPortraits } from "@/lib/person-portraits";
export function PersonAvatar({ person, large = false }: { person: Person; large?: boolean }) {
  const url = person.avatarUrl ?? personPortraits[person.id];
  return <span className={`person-avatar tone-${person.tone}${large ? " avatar-large" : ""}`} aria-hidden="true">{url ? <Portrait key={url} url={url} glyph={person.glyph} /> : person.glyph}</span>;
}
function Portrait({ url, glyph }: { url: string; glyph: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? glyph : <Image src={url} width={160} height={160} unoptimized alt="" onError={() => setFailed(true)} />;
}
