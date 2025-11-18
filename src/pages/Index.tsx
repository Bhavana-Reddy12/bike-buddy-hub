import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Users, Activity, Plus, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type BikeStatus = "AVAILABLE" | "RENTED" | "IN_REPAIR";

interface BikeType {
  bike_id: string;
  model: string;
  hourly_rate: number;
  status: BikeStatus;
  last_maintenance_date: string;
  notes: string | null;
}

interface CustomerType {
  id: number;
  name: string;
}

interface RentalType {
  id: number;
  customer_id: number;
  bike_id: string;
  start_time: string;
  is_returned: boolean;
  duration_hours: number | null;
  final_cost: number | null;
  customers: CustomerType;
  bikes: BikeType;
}

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [bikes, setBikes] = useState<BikeType[]>([]);
  const [rentals, setRentals] = useState<RentalType[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newBikeId, setNewBikeId] = useState("");
  const [newBikeModel, setNewBikeModel] = useState("");
  const [newBikeRate, setNewBikeRate] = useState("");
  
  const [rentalCustomerName, setRentalCustomerName] = useState("");
  const [rentalBikeId, setRentalBikeId] = useState("");
  
  const [endRentalId, setEndRentalId] = useState("");
  const [endRentalDuration, setEndRentalDuration] = useState("");
  
  const [statusChangeBikeId, setStatusChangeBikeId] = useState("");
  const [statusChangeNewStatus, setStatusChangeNewStatus] = useState<BikeStatus>("AVAILABLE");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: bikesData } = await supabase.from("bikes").select("*");
      const { data: rentalsData } = await supabase
        .from("rentals")
        .select("*, customers(*), bikes(*)")
        .eq("is_returned", false);

      setBikes(bikesData || []);
      setRentals(rentalsData || []);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBike = async () => {
    if (!newBikeId || !newBikeModel || !newBikeRate) {
      toast.error("Please fill all bike fields");
      return;
    }

    try {
      const { error } = await supabase.from("bikes").insert({
        bike_id: newBikeId,
        model: newBikeModel,
        hourly_rate: parseFloat(newBikeRate),
        status: "AVAILABLE",
      });

      if (error) throw error;
      
      toast.success("Bike added successfully!");
      setNewBikeId("");
      setNewBikeModel("");
      setNewBikeRate("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to add bike");
    }
  };

  const handleStartRental = async () => {
    if (!rentalCustomerName || !rentalBikeId) {
      toast.error("Please fill all rental fields");
      return;
    }

    try {
      // Find or create customer
      let customerId: number;
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("name", rentalCustomerName)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({ name: rentalCustomerName })
          .select("id")
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create rental
      const { error: rentalError } = await supabase.from("rentals").insert({
        customer_id: customerId,
        bike_id: rentalBikeId,
        is_returned: false,
      });

      if (rentalError) throw rentalError;

      // Update bike status
      const { error: bikeError } = await supabase
        .from("bikes")
        .update({ status: "RENTED" })
        .eq("bike_id", rentalBikeId);

      if (bikeError) throw bikeError;

      toast.success("Rental started successfully!");
      setRentalCustomerName("");
      setRentalBikeId("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to start rental");
    }
  };

  const handleEndRental = async () => {
    if (!endRentalId || !endRentalDuration) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const rentalId = parseInt(endRentalId);
      const duration = parseInt(endRentalDuration);

      // Get rental details
      const { data: rental } = await supabase
        .from("rentals")
        .select("*, bikes(*)")
        .eq("id", rentalId)
        .single();

      if (!rental) throw new Error("Rental not found");

      const finalCost = rental.bikes.hourly_rate * duration;

      // Update rental
      const { error: rentalError } = await supabase
        .from("rentals")
        .update({
          is_returned: true,
          duration_hours: duration,
          final_cost: finalCost,
        })
        .eq("id", rentalId);

      if (rentalError) throw rentalError;

      // Update bike status
      const { error: bikeError } = await supabase
        .from("bikes")
        .update({ status: "AVAILABLE" })
        .eq("bike_id", rental.bike_id);

      if (bikeError) throw bikeError;

      toast.success(`Rental ended! Final charge: $${finalCost.toFixed(2)}`);
      setEndRentalId("");
      setEndRentalDuration("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to end rental");
    }
  };

  const handleChangeStatus = async () => {
    if (!statusChangeBikeId) {
      toast.error("Please select a bike");
      return;
    }

    try {
      const { error } = await supabase
        .from("bikes")
        .update({ status: statusChangeNewStatus })
        .eq("bike_id", statusChangeBikeId);

      if (error) throw error;

      toast.success("Bike status updated!");
      setStatusChangeBikeId("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  const StatusBadge = ({ status }: { status: BikeStatus }) => {
    const statusConfig = {
      AVAILABLE: { color: "bg-success text-success-foreground", label: "Available" },
      RENTED: { color: "bg-warning text-warning-foreground", label: "Rented" },
      IN_REPAIR: { color: "bg-destructive text-destructive-foreground", label: "In Repair" },
    };

    const config = statusConfig[status];

    return (
      <motion.span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}
        animate={status === "RENTED" ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {config.label}
      </motion.span>
    );
  };

  const availableBikes = bikes.filter((b) => b.status === "AVAILABLE");
  const activeRentals = rentals.filter((r) => !r.is_returned);

  return (
    <div className="min-h-screen bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Bike Rental Management
          </h1>
          <p className="text-muted-foreground">
            Staff dashboard for managing bikes and rentals
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="dashboard" className="gap-2">
              <Activity className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="rentals" className="gap-2">
              <Users className="w-4 h-4" />
              Rental Operations
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Bike className="w-4 h-4" />
              Inventory
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="dashboard" className="space-y-6">
              <motion.div
                key="dashboard"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <motion.div variants={cardVariants}>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-success" />
                          Available Bikes
                        </CardTitle>
                        <CardDescription>
                          {availableBikes.length} bikes ready to rent
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {availableBikes.map((bike, idx) => (
                            <motion.div
                              key={bike.bike_id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="p-4 rounded-lg bg-card border border-border"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold">{bike.bike_id}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {bike.model}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-primary">
                                    ${bike.hourly_rate}/hr
                                  </p>
                                  <StatusBadge status={bike.status} />
                                </div>
                              </div>
                            </motion.div>
                          ))}
                          {availableBikes.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">
                              No bikes available
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={cardVariants}>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-warning" />
                          Active Rentals
                        </CardTitle>
                        <CardDescription>
                          {activeRentals.length} bikes currently rented
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {activeRentals.map((rental, idx) => (
                            <motion.div
                              key={rental.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="p-4 rounded-lg bg-card border border-border"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold">
                                    Rental #{rental.id}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {rental.customers.name}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold">{rental.bike_id}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(rental.start_time).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                          {activeRentals.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">
                              No active rentals
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="rentals">
              <motion.div
                key="rentals"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="grid gap-6 md:grid-cols-2"
              >
                <motion.div variants={cardVariants}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Start Rental</CardTitle>
                      <CardDescription>
                        Begin a new bike rental
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="customerName">Customer Name</Label>
                        <Input
                          id="customerName"
                          value={rentalCustomerName}
                          onChange={(e) => setRentalCustomerName(e.target.value)}
                          placeholder="Enter customer name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bikeSelect">Select Bike</Label>
                        <Select value={rentalBikeId} onValueChange={setRentalBikeId}>
                          <SelectTrigger id="bikeSelect">
                            <SelectValue placeholder="Choose available bike" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableBikes.map((bike) => (
                              <SelectItem key={bike.bike_id} value={bike.bike_id}>
                                {bike.bike_id} - {bike.model} (${bike.hourly_rate}/hr)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleStartRental} className="w-full">
                        Start Rental
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={cardVariants}>
                  <Card>
                    <CardHeader>
                      <CardTitle>End Rental</CardTitle>
                      <CardDescription>
                        Complete an active rental
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="rentalSelect">Select Rental</Label>
                        <Select value={endRentalId} onValueChange={setEndRentalId}>
                          <SelectTrigger id="rentalSelect">
                            <SelectValue placeholder="Choose active rental" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeRentals.map((rental) => (
                              <SelectItem
                                key={rental.id}
                                value={rental.id.toString()}
                              >
                                #{rental.id} - {rental.customers.name} ({rental.bike_id})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="duration">Duration (hours)</Label>
                        <Input
                          id="duration"
                          type="number"
                          value={endRentalDuration}
                          onChange={(e) => setEndRentalDuration(e.target.value)}
                          placeholder="Enter hours"
                        />
                      </div>
                      <Button onClick={handleEndRental} className="w-full">
                        End Rental
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>

            <TabsContent value="inventory">
              <motion.div
                key="inventory"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="grid gap-6 md:grid-cols-2"
              >
                <motion.div variants={cardVariants}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Add New Bike
                      </CardTitle>
                      <CardDescription>
                        Register a new bike to the system
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="bikeId">Bike ID</Label>
                        <Input
                          id="bikeId"
                          value={newBikeId}
                          onChange={(e) => setNewBikeId(e.target.value)}
                          placeholder="e.g., BIKE001"
                        />
                      </div>
                      <div>
                        <Label htmlFor="model">Model</Label>
                        <Input
                          id="model"
                          value={newBikeModel}
                          onChange={(e) => setNewBikeModel(e.target.value)}
                          placeholder="e.g., Mountain Pro X"
                        />
                      </div>
                      <div>
                        <Label htmlFor="rate">Hourly Rate ($)</Label>
                        <Input
                          id="rate"
                          type="number"
                          step="0.01"
                          value={newBikeRate}
                          onChange={(e) => setNewBikeRate(e.target.value)}
                          placeholder="e.g., 15.00"
                        />
                      </div>
                      <Button onClick={handleAddBike} className="w-full">
                        Add Bike
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={cardVariants}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Manage Status</CardTitle>
                      <CardDescription>
                        Update bike availability status
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="statusBike">Select Bike</Label>
                        <Select
                          value={statusChangeBikeId}
                          onValueChange={setStatusChangeBikeId}
                        >
                          <SelectTrigger id="statusBike">
                            <SelectValue placeholder="Choose bike" />
                          </SelectTrigger>
                          <SelectContent>
                            {bikes.map((bike) => (
                              <SelectItem key={bike.bike_id} value={bike.bike_id}>
                                {bike.bike_id} - {bike.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="newStatus">New Status</Label>
                        <Select
                          value={statusChangeNewStatus}
                          onValueChange={(val) =>
                            setStatusChangeNewStatus(val as BikeStatus)
                          }
                        >
                          <SelectTrigger id="newStatus">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AVAILABLE">Available</SelectItem>
                            <SelectItem value="IN_REPAIR">In Repair</SelectItem>
                            <SelectItem value="RENTED">Rented</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleChangeStatus} className="w-full">
                        Update Status
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={cardVariants} className="md:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>All Bikes</CardTitle>
                      <CardDescription>
                        Complete inventory of {bikes.length} bikes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {bikes.map((bike, idx) => (
                          <motion.div
                            key={bike.bike_id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-4 rounded-lg bg-secondary border border-border"
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-lg">
                                    {bike.bike_id}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {bike.model}
                                  </p>
                                </div>
                                <StatusBadge status={bike.status} />
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-border">
                                <span className="text-sm text-muted-foreground">
                                  Rate
                                </span>
                                <span className="font-bold text-primary">
                                  ${bike.hourly_rate}/hr
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Index;
