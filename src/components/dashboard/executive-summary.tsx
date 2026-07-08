import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default function ExecutiveSummary() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm">

      <div className="flex items-start gap-4">

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
          <Sparkles className="h-6 w-6 text-emerald-300" />
        </div>

        <div className="flex-1">

          <div className="mb-1 flex items-center gap-2">

            <span className="text-xs uppercase tracking-[0.2em] text-slate-300">
              AI Executive Summary
            </span>

            <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-300">
              Confidence 94%
            </span>

          </div>

          <h2 className="mb-3 text-2xl font-bold">
            El estado general del pipeline es positivo.
          </h2>

          <p className="max-w-4xl text-sm leading-7 text-slate-300">
            Durante esta semana se han registrado <strong>4 nuevas propuestas</strong>.
            Dylan Ennis continúa siendo la colaboración con mayor potencial para MUSAI,
            mientras que SeventyTwo Sports Group mantiene un excelente equilibrio entre
            notoriedad, contenido reutilizable y oportunidades B2B.
            Actualmente existen dos propuestas pendientes de decisión y el riesgo medio
            del pipeline permanece en nivel bajo.
          </p>

        </div>

      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">

        <div className="rounded-xl bg-white/5 p-4">

          <div className="mb-2 flex items-center gap-2">

            <TrendingUp className="h-5 w-5 text-emerald-400" />

            <h3 className="font-semibold">
              Oportunidad
            </h3>

          </div>

          <p className="text-sm text-slate-300">
            Priorizar la negociación con Dylan Ennis antes del inicio de la
            pretemporada.
          </p>

        </div>

        <div className="rounded-xl bg-white/5 p-4">

          <div className="mb-2 flex items-center gap-2">

            <AlertTriangle className="h-5 w-5 text-amber-400" />

            <h3 className="font-semibold">
              Riesgo
            </h3>

          </div>

          <p className="text-sm text-slate-300">
            Lanzamiento del Legón presenta una excelente notoriedad,
            aunque todavía existen dudas sobre el retorno real.
          </p>

        </div>

        <div className="rounded-xl bg-white/5 p-4">

          <div className="mb-2 flex items-center gap-2">

            <CheckCircle2 className="h-5 w-5 text-emerald-400" />

            <h3 className="font-semibold">
              Recomendación
            </h3>

          </div>

          <p className="text-sm text-slate-300">
            Mantener el presupuesto disponible para colaboraciones estratégicas
            del cuarto trimestre.
          </p>

        </div>

      </div>

    </section>
  );
}