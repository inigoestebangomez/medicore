'use client';

import { type ReactNode } from 'react';
import { useSession } from 'next-auth/react';

interface Study {
  id: string;
  type: string;
  date: string;
  thumbnail: string;
}

interface StudyGroup {
  label: string;
  studies: Study[];
}

interface ImagingViewerLayoutProps {
  studyGroups: StudyGroup[];
  selectedStudyId?: string;
  onSelectStudy: (studyId: string) => void;
  /** The main viewer content (DICOM canvas, image, etc.) */
  viewerContent: ReactNode;
  /** Right panel — measurements, annotations, tools */
  rightPanel?: ReactNode;
}

export function ImagingViewerLayout({
  studyGroups,
  selectedStudyId,
  onSelectStudy,
  viewerContent,
  rightPanel,
}: ImagingViewerLayoutProps) {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? 'Usuario';
  return (
    <div className="imaging-mode grid grid-cols-[280px_1fr_300px] grid-rows-[48px_1fr] h-screen bg-black gap-0 animate-[imaging-mode-enter_400ms_ease-in-out_forwards]">
      {/* Topbar — minimal, always visible */}
      <div className="col-span-3 flex items-center gap-4 px-5 bg-black/80 border-b border-white/[0.05] backdrop-blur-xl">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          Visor de Imágenes
        </span>
        <span className="text-xs text-zinc-600">|</span>
        <span className="text-xs text-zinc-400">{userName} · Otorrinolaringólogo</span>
      </div>

      {/* Left panel — study thumbnails */}
      <aside className="bg-zinc-950/90 border-r border-white/[0.05] overflow-y-auto">
        {studyGroups.map((group) => (
          <div key={group.label} className="p-4 border-b border-white/[0.04]">
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              {group.label}
            </p>

            {group.studies.map((study) => (
              <button
                key={study.id}
                type="button"
                onClick={() => onSelectStudy(study.id)}
                data-selected={study.id === selectedStudyId}
                className="w-full mb-2 relative group rounded-lg overflow-hidden border border-transparent hover:border-aqua-500/40 transition-all duration-150 data-[selected=true]:border-aqua-500/60 data-[selected=true]:shadow-glow-aqua"
              >
                <img
                  src={study.thumbnail}
                  alt={study.type}
                  className="w-full aspect-video object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-2">
                  <p className="text-xs font-medium text-white uppercase tracking-wide">
                    {study.type}
                  </p>
                  <p className="text-xs text-zinc-400">{study.date}</p>
                </div>
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* Center — viewer */}
      <main className="relative bg-black flex items-center justify-center overflow-hidden">
        {viewerContent}
      </main>

      {/* Right panel — tools */}
      {rightPanel && (
        <aside className="bg-zinc-950/90 border-l border-white/[0.05] overflow-y-auto p-4">
          {rightPanel}
        </aside>
      )}
    </div>
  );
}