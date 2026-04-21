import { Construction } from "lucide-react";

export function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <Construction size={48} className="mb-4 text-yellow-500" />
      <h2 className="text-2xl font-bold text-gray-900">
        We&apos;re working on this feature!
      </h2>
      <p className="mt-2 text-gray-500">
        Come back later &mdash; something great is on the way.
      </p>
    </div>
  );
}
