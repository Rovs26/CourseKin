import { Flashcard } from "@/components/reviewer/flashcard";

export function FlashcardsPanel({
  cards,
}: {
  cards: { front: string; back: string }[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card, index) => (
        <Flashcard key={index} front={card.front} back={card.back} />
      ))}
    </div>
  );
}