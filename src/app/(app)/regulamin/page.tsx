import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
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
  ARTICLES,
  CLOSING,
  FEES,
  FUNDS_USE,
  REGULAMIN_TITLE,
} from "@/lib/regulamin"

export default function RegulaminPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">{REGULAMIN_TITLE}</h1>
        <p className="text-sm text-muted-foreground">
          Obowiązuje wszystkich zapisanych na V3. Składka za przelot jest liczona w zapisach; dodatkowe 4 kk z §2
          admin odhacza osobno.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {ARTICLES.map((article) => (
          <Card key={article.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">§{article.id}</Badge>
                {article.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {"paragraphs" in article
                ? article.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))
                : null}
              {"bullets" in article ? (
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {article.bullets.map((item) => (
                    <li key={item}>
                      {item.includes("4 kk") ? <strong>{item}</strong> : item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Składka za przelot</CardTitle>
            <CardDescription>Stawka zapamiętywana przy zapisie na siatce.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rodzaj postaci</TableHead>
                  <TableHead>Składka</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FEES.map((fee) => (
                  <TableRow key={fee.kind}>
                    <TableCell>{fee.kind}</TableCell>
                    <TableCell className="font-medium">{fee.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Przeznaczenie zebranych środków</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{FUNDS_USE}</p>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <AlertTitle>Postanowienia końcowe</AlertTitle>
        <AlertDescription>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {CLOSING.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}
