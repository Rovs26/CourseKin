import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DefinitionsPanel({
  definitions,
}: {
  definitions: { term: string; definition: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px]">Term</TableHead>
            <TableHead>Definition</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {definitions.map((item, index) => (
            <TableRow key={`${index}-${item.term}`}>
              <TableCell className="font-medium text-slate-900">{item.term}</TableCell>
              <TableCell className="text-slate-600">{item.definition}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}