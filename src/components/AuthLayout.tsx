import type { ReactNode } from "react";
import chapadaLogo from "@/assets/chapada-logo.png";

/**
 * Tela cheia em tema claro com gradiente azul gelo.
 * Card central com lado esquerdo azul CHAPADA e lado direito branco.
 */
export function AuthLayout({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #EAF4FB 0%, #C8E9F5 100%)",
        color: "#1A3A4A",
      }}
    >
      <BackgroundGraphics />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div
          className="w-full max-w-5xl overflow-hidden rounded-2xl border bg-white"
          style={{
            borderColor: "#C4DFF0",
            boxShadow: "0 20px 50px -20px rgba(26, 159, 212, 0.25)",
          }}
        >
          <div className="grid md:grid-cols-2">
            <div
              className="flex items-center justify-center p-8 md:p-12"
              style={{ backgroundColor: "#1A9FD4" }}
            >
              {left}
            </div>
            <div className="flex items-center justify-center bg-white p-8 md:p-12">
              <div className="w-full max-w-sm">{right}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChapadaLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <div className="relative grid h-28 w-28 place-items-center">
        <img
          src={chapadaLogo}
          alt="Logo CHAPADA"
          className="h-full w-full object-contain drop-shadow-lg"
        />
      </div>
      <div className="mt-4">
        <p className="font-display text-3xl font-bold tracking-wide text-white">CHAPADA</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/80">
          Gestão de Projetos
        </p>
      </div>
    </div>
  );
}

function BackgroundGraphics() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, rgba(26,159,212,0.18) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(245,166,35,0.14) 0%, transparent 45%)",
        }}
      />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1440 900"
        fill="none"
      >
        <g stroke="#1A9FD4" strokeWidth="1.2">
          {Array.from({ length: 14 }).map((_, i) => (
            <line
              key={i}
              x1={-200 + i * 130}
              y1="900"
              x2={400 + i * 60}
              y2="450"
            />
          ))}
        </g>
        <circle cx="1200" cy="180" r="80" stroke="#F5A623" strokeWidth="1.5" />
        <circle cx="1200" cy="180" r="120" stroke="#F5A623" strokeWidth="0.8" />
        <g stroke="#1A9FD4" strokeWidth="1.5" strokeLinecap="round">
          <path d="M120 700 Q140 640 130 580 M130 580 Q110 600 100 620 M130 580 Q150 600 160 620" />
          <path d="M1320 760 Q1340 700 1330 640 M1330 640 Q1310 660 1300 680 M1330 640 Q1350 660 1360 680" />
        </g>
        <g stroke="#F5A623" strokeWidth="1.2" strokeLinecap="round">
          <line x1="240" y1="800" x2="240" y2="700" />
          <path d="M240 720 L225 715 M240 720 L255 715 M240 740 L223 735 M240 740 L257 735 M240 760 L221 755 M240 760 L259 755" />
        </g>
      </svg>
    </>
  );
}
