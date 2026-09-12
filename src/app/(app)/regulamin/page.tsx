import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getFeeSettlementDays,
  getPenaltyRules,
  getSignupAdvanceDays,
  getSignupOpenTime,
} from "@/lib/settings"
import {
  Clock,
  Calendar,
  Coins,
  AlertTriangle,
  Swords,
  Shield,
  CheckCircle2,
  Sparkles,
} from "lucide-react"

export const dynamic = "force-dynamic"

function formatDaysPl(n: number): string {
  if (n === 1) return "1 dzień"
  return `${n} dni`
}

function formatDaysAheadPl(n: number): string {
  if (n === 0) return "tylko w dniu wydarzenia"
  if (n === 1) return "maks. 1 dzień wcześniej"
  return `maks. ${n} dni wcześniej`
}

function getSettlementDayPl(days: number): string {
  switch (days) {
    case 1:
      return "poniedziałku (do 23:59)"
    case 2:
      return "wtorku (do 23:59)"
    case 3:
      return "środy (do 23:59)"
    case 4:
      return "czwartku (do 23:59)"
    case 5:
      return "piątku (do 23:59)"
    case 6:
      return "soboty (do 23:59)"
    case 7:
      return "niedzieli (do 23:59)"
    default:
      return `${days}. dnia nowego tygodnia`
  }
}

export default async function RegulaminPage() {
  const [signupAdvanceDays, signupOpenTime, penaltyRules, feeSettlementDays] =
    await Promise.all([
      getSignupAdvanceDays(),
      getSignupOpenTime(),
      getPenaltyRules(),
      getFeeSettlementDays(),
    ])

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col gap-1.5 border-b pb-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Gildia</Badge>
          <span className="text-xs text-muted-foreground">Aktualne zasady</span>
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
          Regulamin Gildii & Wypraw V3
        </h1>
        <p className="text-sm text-muted-foreground">
          Zasady obstawiania slotów, zapisów, rozliczania składek oraz wymagania bojowe.
        </p>
      </div>

      {/* SEKCJA GŁÓWNA: WSZYSTKO O V3 */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              Wszystko o V3: Wyprawy, Zapisy, Składki i Kary
            </h2>
            <p className="text-xs text-muted-foreground">
              Komplet reguł związanych z codziennymi przelotami na V3. Parametry pobierane na bieżąco z konfiguracji.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* 1. Godziny slotów & Priorytet */}
          <Card className="border-border/70">
            <CardHeader className="pb-2.5">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                Godziny slotów & Priorytet po walce
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>
                • <strong className="text-foreground">Godziny obstawiania:</strong> Główne przeloty odbywają się w godzinach{" "}
                <strong className="text-foreground">08:30 – 20:30</strong> (4 bloki po 3 godziny: 08:30, 11:30, 14:30, 17:30).
              </p>
              <p>
                • <strong className="text-foreground">Priorytet powrotu po bitce:</strong> Jeśli w trakcie Twojego slotu PvM wbiła wroga gildia i musiałeś przelogować się na postać PvP do obrony, po skończonej walce masz{" "}
                <strong className="text-foreground">bezwzględne pierwszeństwo</strong> do dokończenia swojego czasu na spocie.
              </p>
            </CardContent>
          </Card>

          {/* 2. Zapisy & Dodatkowa postać */}
          <Card className="border-border/70">
            <CardHeader className="pb-2.5">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 font-semibold">
                <Calendar className="h-4 w-4 text-primary" />
                Zasady zapisów i limit postaci
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>
                • <strong className="text-foreground">Otwarcie zapisów:</strong> Zapisy na dany dzień ruszają na{" "}
                <strong className="text-foreground">{formatDaysPl(signupAdvanceDays)}</strong> przed wyprawą, punktualnie o godz.{" "}
                <strong className="text-foreground">{signupOpenTime}</strong> (czasu polskiego). Wcześniej system nie pozwoli na rezerwację miejsca.
              </p>
              <p>
                • <strong className="text-foreground">Druga postać na koncie:</strong> Jeden gracz może zająć maksymalnie 2 spoty na jedno wydarzenie. Zapis drugą postacią jest możliwy{" "}
                <strong className="text-foreground">wyłącznie w dniu wydarzenia</strong> (od 00:00), aby nie blokować miejsc innym z wyprzedzeniem.
              </p>
            </CardContent>
          </Card>

          {/* 3. Składki za przelot & Auto-lock */}
          <Card className="border-border/70">
            <CardHeader className="pb-2.5">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 font-semibold">
                <Coins className="h-4 w-4 text-primary" />
                Składki za V3 i automatyczna blokada
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs sm:text-sm leading-relaxed">
              <div className="rounded-lg border bg-muted/40 p-2.5 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs sm:text-sm border-b pb-1.5">
                  <span className="text-muted-foreground">Postać walcząca (PvP / PvM)</span>
                  <span className="font-bold text-foreground">3 kk / przelot</span>
                </div>
                <div className="flex justify-between items-center text-xs sm:text-sm pt-0.5">
                  <span className="text-muted-foreground">Czyste PvM (brak udziału w bitkach)</span>
                  <span className="font-bold text-foreground">7 kk / przelot</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                * Dodatkowe 4 kk od czystego PvM to wkład do wspólnej puli na odpał wojenny (ryby, wody, ataki, rosy, przepustki).
              </p>
              <p className="text-xs text-muted-foreground">
                • <strong className="text-foreground">Termin rozliczenia (Auto-lock):</strong> Na opłacenie zeszłotygodniowych składek masz czas do{" "}
                <strong className="text-foreground">{getSettlementDayPl(feeSettlementDays)}</strong>. Jeśli w tym terminie składka nie zostanie opłacona i potwierdzona przez lidera, system{" "}
                <strong className="text-foreground">automatycznie blokuje zapisy</strong> na kolejne V3.
              </p>
            </CardContent>
          </Card>

          {/* 4. Żółte kartki i kary */}
          <Card className="border-border/70">
            <CardHeader className="pb-2.5">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Kary za nieobecność (Żółte kartki)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-xs sm:text-sm leading-relaxed">
              <p className="text-xs text-muted-foreground">
                Zwolnienie miejsca w ostatniej chwili (&lt; 2h przed startem bez zastępstwa) lub niepojawienie się na wyprawie skutkuje żółtą kartką:
              </p>
              <div className="rounded-lg border bg-background/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/30">
                      <TableHead className="py-2">Poziom kary</TableHead>
                      <TableHead className="py-2">Czas trwania</TableHead>
                      <TableHead className="py-2">Ograniczenie zapisu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    <TableRow>
                      <TableCell className="py-2 font-medium text-amber-400">
                        🟨 Jedna żółta kartka
                      </TableCell>
                      <TableCell className="py-2 font-semibold">{formatDaysPl(penaltyRules.card1.durationDays)}</TableCell>
                      <TableCell className="py-2 text-muted-foreground">{formatDaysAheadPl(penaltyRules.card1.advanceDays)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="py-2 font-medium text-amber-500">
                        🟨🟨 Dwie żółte kartki
                      </TableCell>
                      <TableCell className="py-2 font-semibold">{formatDaysPl(penaltyRules.card2.durationDays)}</TableCell>
                      <TableCell className="py-2 text-muted-foreground">{formatDaysAheadPl(penaltyRules.card2.advanceDays)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="py-2 font-medium text-amber-500">
                        🟨🟨🟨 Trzy żółte kartki
                      </TableCell>
                      <TableCell className="py-2 font-semibold">{formatDaysPl(penaltyRules.card3.durationDays)}</TableCell>
                      <TableCell className="py-2 text-muted-foreground">{formatDaysAheadPl(penaltyRules.card3.advanceDays)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Kara znika automatycznie po upływie wskazanego czasu lub gdy lider zdejmie ją ręcznie.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SEKCJA 2: ZASADY WOJENNE & POSTACIE PVP */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
            <Swords className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              Zasady Wojenne & Postacie PvP
            </h2>
            <p className="text-xs text-muted-foreground">
              Wymagania sprzętowe, dyscyplina w walkach oraz podział ról w gildii.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" />
                Definicja postaci PvP
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs sm:text-sm text-muted-foreground flex flex-col gap-2">
              <p>Za postać PvP uznaje się postać, która posiada:</p>
              <ul className="list-disc pl-4 space-y-1.5 text-xs">
                <li>Minimum dwie umiejętności bojowe na poziomie <strong className="text-foreground">P</strong></li>
                <li>Odpowiedni ekwipunek wojenny (<strong className="text-foreground">nie padasz na skilla</strong>)</li>
                <li>
                  Priorytetyzujemy absy / odporności:{" "}
                  <strong className="text-foreground">miecze, dwuręka, sztylety i strzały</strong>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Swords className="h-4 w-4 text-red-400" />
                Dyscyplina i rozkazy
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs sm:text-sm text-muted-foreground flex flex-col gap-2">
              <p>
                Zakaz bezsensownego wbiegania PvP-kiem solo. Wchodzenie w walki 1 vs 3 jest bezsensowne, a gildia nie będzie sponsorować takich samobójczych akcji.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-amber-400" />
                Benefity dla PvP
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs sm:text-sm text-muted-foreground flex flex-col gap-1.5 text-xs">
              <p>• Niższa składka na V3 (3 kk zamiast 7 kk).</p>
              <p>• Do jednej postaci PvP można przypisać maksymalnie dwie postacie PvM.</p>
              <p>• Wsparcie odpałem z puli gildyjnej (ryby, wody, rosy, przepustki).</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Postanowienia końcowe */}
      <Alert className="bg-card/70 border-border/80">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <AlertTitle className="text-sm font-semibold">Postanowienia końcowe</AlertTitle>
        <AlertDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
          Regulamin obowiązuje wszystkich członków gildii bez wyjątku. Jego celem jest sprawna organizacja, uczciwy podział slotów oraz płynny przebieg każdej wyprawy na V3.
        </AlertDescription>
      </Alert>
    </div>
  )
}
