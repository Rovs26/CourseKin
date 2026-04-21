import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const plans = [
  { name: "Starter", price: "$0", desc: "Basic reviewer generation" },
  { name: "Pro", price: "$19", desc: "Higher limits and richer reviewer exports" },
  { name: "Team", price: "$49", desc: "Shared workspaces and admin controls" },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-4 text-slate-600">
          Simple usage-based pricing for students, educators, and teams.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{plan.price}</p>
              <p className="mt-2 text-sm text-slate-500">{plan.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}