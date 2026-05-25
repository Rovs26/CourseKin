import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EvidenceCitations } from "@/components/reviewer/evidence-citations";
import type { ReviewerEvidenceItem, ReviewerFeedbackRating } from "@/types/reviewer";

export function DefinitionsPanel({
  definitions,
  evidence,
  onFeedback,
}: {
  definitions: { term: string; definition: string }[];
  evidence?: ReviewerEvidenceItem[];
  onFeedback?: (index: number, rating: ReviewerFeedbackRating) => Promise<void>;
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
              <TableCell className="text-slate-600">
                {item.definition}
                <EvidenceCitations
                  evidence={evidence?.[index]}
                  onFeedback={onFeedback ? (rating) => onFeedback(index, rating) : undefined}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
