import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Users, Activity, Plus, CheckCircle, AlertCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import RotatingText from "@/components/RotatingText";
import Bill, { BillProps } from "@/components/Bill";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [activeTab, setActiveTab] = useState("dashboard");
  const [bikes, setBikes] = useState<BikeType[]>([]);
  const [rentals, setRentals] = useState<RentalType[]>([]);
  const [completedRentals, setCompletedRentals] = useState<RentalType[]>([]);
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

  const [showBill, setShowBill] = useState(false);
  const [billDetails, setBillDetails] = useState<BillProps | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'root' && password === 'root') {
      setIsLoggedIn(true);
      toast.success("Login Successful - Welcome to Bike Buddy!");
    } else {
      toast.error("Invalid username or password");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    toast.success("Logged out successfully");
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
    }
  }, [isLoggedIn]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: bikesData } = await supabase.from("bikes").select("*");
      const { data: rentalsData } = await supabase
        .from("rentals")
        .select("*, customers(*), bikes(*)")
        .eq("is_returned", false);
      const { data: completedRentalsData } = await supabase
        .from("rentals")
        .select("*, customers(*), bikes(*)")
        .eq("is_returned", true)
        .order("start_time", { ascending: false });

      setBikes(bikesData || []);
      setRentals(rentalsData || []);
      setCompletedRentals(completedRentalsData || []);
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
          .select()
          .single();

        if (customerError || !newCustomer) throw customerError;
        customerId = newCustomer.id;
      }

      // Create rental
      const { error: rentalError } = await supabase.from("rentals").insert({
        customer_id: customerId,
        bike_id: rentalBikeId,
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

    const duration = parseInt(endRentalDuration);

    try {
      // Get rental details
      const { data: rental } = await supabase
        .from("rentals")
        .select("*, bikes(*), customers(*)")
        .eq("id", parseInt(endRentalId))
        .single();

      if (!rental) {
        toast.error("Rental not found");
        return;
      }

      const finalCost = rental.bikes.hourly_rate * duration;

      // Update rental
      const { error: rentalError } = await supabase
        .from("rentals")
        .update({
          is_returned: true,
          duration_hours: duration,
          final_cost: finalCost,
        })
        .eq("id", parseInt(endRentalId));

      if (rentalError) throw rentalError;

      // Update bike status
      const { error: bikeError } = await supabase
        .from("bikes")
        .update({ status: "AVAILABLE" })
        .eq("bike_id", rental.bike_id);

      if (bikeError) throw bikeError;

      setBillDetails({
        customerName: rental.customers.name,
        bikeModel: rental.bikes.model,
        duration: duration,
        cost: finalCost,
        bikeId: rental.bike_id,
      });
      setShowBill(true);

      toast.success(`Rental ended! Final charge: ₹${finalCost.toFixed(2)}`);
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

  const getStatusColor = (status: BikeStatus) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-green-600 text-white";
      case "RENTED":
        return "bg-yellow-600 text-white";
      case "IN_REPAIR":
        return "bg-red-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  // Login page
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
                <Bike className="w-8 h-8 text-primary" />
                Bike Buddy
              </CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Login
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const availableBikes = bikes.filter((b) => b.status === "AVAILABLE");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Dialog open={showBill} onOpenChange={setShowBill}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rental Bill</DialogTitle>
          </DialogHeader>
          {billDetails && <Bill {...billDetails} />}
        </DialogContent>
      </Dialog>
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
              <Bike className="w-8 h-8 text-primary" />
              <span className="text-foreground">Bike </span>
              <RotatingText 
                texts={["Rentals", "Anytime", "Buddy", "24/7", "Zone"]}
                mainClassName="text-primary"
                rotationInterval={2000}
              />
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Rental Management System</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dashboard">
                <Activity className="w-4 h-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="rentals">
                <Users className="w-4 h-4 mr-2" />
                Rentals
              </TabsTrigger>
              <TabsTrigger value="inventory">
                <Bike className="w-4 h-4 mr-2" />
                Inventory
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Dashboard Tab */}
                <TabsContent value="dashboard" className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Available Bikes</CardTitle>
                        <CardDescription>Currently available for rent</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {loading ? (
                          <p className="text-muted-foreground">Loading...</p>
                        ) : (
                          <div className="space-y-3">
                            {availableBikes.length === 0 ? (
                              <p className="text-muted-foreground">No bikes available</p>
                            ) : (
                              availableBikes.map((bike, index) => (
                                <motion.div
                                  key={bike.bike_id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                  className="p-4 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                                >
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-semibold text-lg">{bike.bike_id}</p>
                                      <p className="text-muted-foreground">{bike.model}</p>
                                    </div>
                                    <p className="text-xl font-bold text-primary">₹{bike.hourly_rate}/hr</p>
                                  </div>
                                </motion.div>
                              ))
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Active Rentals</CardTitle>
                        <CardDescription>Currently ongoing rentals</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {loading ? (
                          <p className="text-muted-foreground">Loading...</p>
                        ) : (
                          <div className="space-y-3">
                            {rentals.length === 0 ? (
                              <p className="text-muted-foreground">No active rentals</p>
                            ) : (
                              rentals.map((rental, index) => (
                                <motion.div
                                  key={rental.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                  className="p-4 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                                >
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-semibold">Rental #{rental.id}</p>
                                      <p className="text-sm text-muted-foreground">{rental.customers.name}</p>
                                      <p className="text-sm text-muted-foreground">Bike: {rental.bike_id}</p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {new Date(rental.start_time).toLocaleString()}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                      >
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                      </motion.div>
                                    </div>
                                  </div>
                                </motion.div>
                              ))
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Completed Trips</CardTitle>
                      <CardDescription>Recently completed rentals</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <p className="text-muted-foreground">Loading...</p>
                      ) : (
                        <div className="space-y-3">
                          {completedRentals.length === 0 ? (
                            <p className="text-muted-foreground">No completed trips yet</p>
                          ) : (
                            completedRentals.map((rental, index) => (
                              <motion.div
                                key={rental.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="p-4 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold">Rental #{rental.id}</p>
                                    <p className="text-sm text-muted-foreground">{rental.customers.name}</p>
                                    <p className="text-sm text-muted-foreground">Bike: {rental.bike_id}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {new Date(rental.start_time).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-lg">₹{rental.final_cost?.toFixed(2)}</p>
                                    <p className="text-sm text-muted-foreground">{rental.duration_hours} hours</p>
                                  </div>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Rentals Tab */}
                <TabsContent value="rentals" className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Start Rental</CardTitle>
                        <CardDescription>Create a new bike rental</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Customer Name</Label>
                          <Input
                            placeholder="Enter customer name"
                            value={rentalCustomerName}
                            onChange={(e) => setRentalCustomerName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Select Bike</Label>
                          <Select value={rentalBikeId} onValueChange={setRentalBikeId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a bike" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableBikes.map((bike) => (
                                <SelectItem key={bike.bike_id} value={bike.bike_id}>
                                  {bike.bike_id} - {bike.model} (₹{bike.hourly_rate}/hr)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleStartRental} className="w-full">
                          <Plus className="w-4 h-4 mr-2" />
                          Start Rental
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>End Rental</CardTitle>
                        <CardDescription>Complete an active rental</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Select Rental</Label>
                          <Select value={endRentalId} onValueChange={setEndRentalId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a rental" />
                            </SelectTrigger>
                            <SelectContent>
                              {rentals.map((rental) => (
                                <SelectItem key={rental.id} value={rental.id.toString()}>
                                  #{rental.id} - {rental.customers.name} ({rental.bike_id})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Duration (hours)</Label>
                          <Input
                            type="number"
                            placeholder="Enter duration"
                            value={endRentalDuration}
                            onChange={(e) => setEndRentalDuration(e.target.value)}
                          />
                        </div>
                        <Button onClick={handleEndRental} className="w-full">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          End Rental
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Inventory Tab */}
                <TabsContent value="inventory" className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Add New Bike</CardTitle>
                        <CardDescription>Register a new bike in the system</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Bike ID</Label>
                          <Input
                            placeholder="e.g., BIKE-001"
                            value={newBikeId}
                            onChange={(e) => setNewBikeId(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Model</Label>
                          <Input
                            placeholder="e.g., Mountain Bike X200"
                            value={newBikeModel}
                            onChange={(e) => setNewBikeModel(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Hourly Rate (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="e.g., 50.00"
                            value={newBikeRate}
                            onChange={(e) => setNewBikeRate(e.target.value)}
                          />
                        </div>
                        <Button onClick={handleAddBike} className="w-full">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Bike
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Change Bike Status</CardTitle>
                        <CardDescription>Update bike availability</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Select Bike</Label>
                          <Select value={statusChangeBikeId} onValueChange={setStatusChangeBikeId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a bike" />
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
                        <div className="space-y-2">
                          <Label>New Status</Label>
                          <Select
                            value={statusChangeNewStatus}
                            onValueChange={(value) => setStatusChangeNewStatus(value as BikeStatus)}
                          >
                            <SelectTrigger>
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
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Update Status
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>All Bikes</CardTitle>
                      <CardDescription>Complete inventory overview</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <p className="text-muted-foreground">Loading...</p>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {bikes.map((bike, index) => (
                            <motion.div
                              key={bike.bike_id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.05 }}
                              className="p-4 border border-border rounded-lg bg-card"
                            >
                              <div className="space-y-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-lg">{bike.bike_id}</p>
                                    <p className="text-sm text-muted-foreground">{bike.model}</p>
                                  </div>
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(bike.status)}`}>
                                    {bike.status}
                                  </span>
                                </div>
                                <p className="text-xl font-bold text-primary">₹{bike.hourly_rate}/hr</p>
                                {bike.notes && (
                                  <p className="text-xs text-muted-foreground">{bike.notes}</p>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="border-t border-border bg-card/50 backdrop-blur-sm mt-auto"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-sm text-muted-foreground">
                © 2024 Bike Buddy. All rights reserved.
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-primary transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

export default Index;
