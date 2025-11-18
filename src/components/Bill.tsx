
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export interface BillProps {
  customerName: string;
  bikeModel: string;
  duration: number;
  cost: number;
  bikeId: string;
}

const Bill = ({ customerName, bikeModel, duration, cost, bikeId }: BillProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Rental Receipt</CardTitle>
        <CardDescription>Thank you for choosing Bike Buddy!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-semibold text-muted-foreground">Customer:</p>
            <p className="text-lg font-medium">{customerName}</p>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground">Bike ID:</p>
            <p className="text-lg font-medium">{bikeId}</p>
          </div>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Bike Model:</p>
          <p className="text-lg font-medium">{bikeModel}</p>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Duration:</p>
          <p className="text-lg font-medium">{duration} hours</p>
        </div>
        <div className="border-t border-border pt-4 mt-4">
          <p className="text-xl font-bold text-right">Total: ₹{cost.toFixed(2)}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default Bill;
