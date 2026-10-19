import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const STAGES = [
  { title: "1. Obrona wozu", text: "Bijemy się z golemami przy palisadach. Są 4 fale." },
  {
    title: "2. Eskorta konwoju",
    text: "Bronimy wozu. Co jakiś czas wóz staje i respią się golemy, które go atakują. Po drodze respią się żyły magicznej rudy, Metin i miniboss. Z wozu dropią pakunki, które trzeba zbierać.",
    todo: "Tipsy do uzupełnienia.",
  },
  {
    title: "Przystanek",
    text: "Tu uzupełniamy potki. To, ile pakunków oddamy, decyduje o trudności świątyni.",
  },
  {
    title: "3. Świątynia",
    text: "Finałowy boss to Królowa Węży Nethis. Na końcu czeka dwóch kowali, takich jak w DT. Broszury Szermierki dropią tylko tutaj.",
  },
]

const PACKAGE_COLUMNS = ["wszystkie oddane", "1–2 zatrzymane", "3–4 zatrzymane"]

// Wóz i pakunki sumują się: <50% = +50/+15, 50–80% = +25/+10, tak samo 3–4 i 1–2 pakunki.
const DIFFICULTY_ROWS = [
  {
    cart: ">80%",
    cells: [
      { level: "bazowy", hp: 0, dmg: 0 },
      { level: "1/4", hp: 25, dmg: 10 },
      { level: null, hp: 50, dmg: 15 },
    ],
  },
  {
    cart: "50–80%",
    cells: [
      { level: "1/4", hp: 25, dmg: 10 },
      { level: "2/4", hp: 50, dmg: 20 },
      { level: "3/4", hp: 75, dmg: 25 },
    ],
  },
  {
    cart: "<50%",
    cells: [
      { level: null, hp: 50, dmg: 15 },
      { level: "3/4", hp: 75, dmg: 25 },
      { level: "4/4", hp: 100, dmg: 30 },
    ],
  },
]

const HP_TONE: Record<number, string> = {
  0: "bg-emerald-500/15",
  25: "bg-yellow-500/15",
  50: "bg-orange-500/20",
  75: "bg-red-500/20",
  100: "bg-purple-500/30 font-bold",
}

export function PanelKonwojView() {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/40 border p-4 rounded-xl text-sm flex flex-col gap-1">
        <h2 className="font-heading text-lg font-bold">Konwój Kompanii</h2>
        <p>
          Wejście raz dziennie, 19:00–22:00. Na etapie 1 i 2 nie można używać koni, a do świątyni wjedzie tylko koń
          na 30 lvl. Kradzież życia z broni (Sura WP) nie działa przez całą wyprawę.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage) => (
          <Card key={stage.title}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-bold">{stage.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed">
              {stage.text}
              {stage.todo ? <p className="mt-2 italic text-muted-foreground">{stage.todo}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Poziom trudności świątyni</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr>
                    <th className="border p-2 text-left">Stan wozu</th>
                    {PACKAGE_COLUMNS.map((col) => (
                      <th key={col} className="border p-2">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DIFFICULTY_ROWS.map((row) => (
                    <tr key={row.cart}>
                      <th className="border p-2 text-left">{row.cart}</th>
                      {row.cells.map((cell, i) => (
                        <td key={i} className={cn("border p-2", HP_TONE[cell.hp])}>
                          {cell.level ? <div className="font-semibold">{cell.level}</div> : null}
                          <div>
                            +{cell.hp}% / +{cell.dmg}%
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Dodatkowe HP / obrażenia mobków. Stan wozu i pakunki się sumują, więcej niż +100% nie będzie.
            </p>
            <p className="text-xs rounded-md border-l-4 border-amber-500 bg-amber-500/10 px-3 py-2">
              Im trudniej, tym lepszy drop. Na bazowym poziomie finałowy boss daje około 120 itemków, przy +100% około
              250. Mobki w świątyni też dropią więcej.
            </p>
          </CardContent>
        </Card>

        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Bonusy</CardTitle>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed flex flex-col gap-1">
              <div>
                <Badge variant="secondary">Silny na Mistyki</Badge> obowiązkowo
              </div>
              <div>
                <Badge variant="outline">Silny na Zwierzęta</Badge> przyda się na bossa
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Postacie</CardTitle>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed">Postacie magiczne bierzemy bardzo chętnie.</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Obserwatorzy</CardTitle>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed">
              Każdy może podglądać naszą wyprawę i za 1 kk dorzucić 3 potwory do następnej fali.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
