import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
}

export default function MetricCard({ title, value, change, icon: Icon, trend = 'neutral' }: MetricCardProps) {
  return (
    <Card className="shadow-card hover:shadow-card-hover transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold font-display text-foreground">{value}</p>
            {change && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                {trend === 'up' && <TrendingUp className="h-3 w-3 text-success" />}
                {trend === 'down' && <TrendingDown className="h-3 w-3 text-destructive" />}
                {trend === 'neutral' && <Minus className="h-3 w-3 text-muted-foreground" />}
                <span className={
                  trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
                }>{change}</span>
              </div>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
