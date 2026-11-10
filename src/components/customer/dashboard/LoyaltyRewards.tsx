import { motion } from 'framer-motion';

interface Props {
  stats: any;
}

export default function LoyaltyRewards({ stats }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl text-white font-bold">Loyalty Rewards</h2>
    </div>
  );
}
