export type BikeStatus = "AVAILABLE" | "RENTED" | "IN_REPAIR";

export interface BikeType {
  bike_id: string;
  model: string;
  hourly_rate: number;
  status: BikeStatus;
  last_maintenance_date: string;
  notes: string | null;
}

export interface CustomerType {
  id: number;
  name: string;
}

export interface RentalRecord {
  id: number;
  customer_id: number;
  bike_id: string;
  start_time: string;
  is_returned: boolean;
  duration_hours: number | null;
  final_cost: number | null;
}

export interface RentalType extends RentalRecord {
  customers: CustomerType;
  bikes: BikeType;
}

interface LocalDatabase {
  bikes: BikeType[];
  customers: CustomerType[];
  rentals: RentalRecord[];
  counters: {
    customerId: number;
    rentalId: number;
  };
}

const STORAGE_KEY = "bike_buddy_local_db";

const defaultDb: LocalDatabase = {
  bikes: [],
  customers: [],
  rentals: [],
  counters: {
    customerId: 1,
    rentalId: 1,
  },
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const loadDb = (): LocalDatabase => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return clone(defaultDb);
  }

  try {
    const parsed = JSON.parse(raw) as LocalDatabase;
    return {
      ...clone(defaultDb),
      ...parsed,
      counters: {
        ...defaultDb.counters,
        ...parsed.counters,
      },
    };
  } catch {
    return clone(defaultDb);
  }
};

const saveDb = (db: LocalDatabase) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

const withRelations = (db: LocalDatabase, rental: RentalRecord): RentalType | null => {
  const customer = db.customers.find((c) => c.id === rental.customer_id);
  const bike = db.bikes.find((b) => b.bike_id === rental.bike_id);

  if (!customer || !bike) {
    return null;
  }

  return {
    ...rental,
    customers: customer,
    bikes: bike,
  };
};

export const getBikes = async (): Promise<BikeType[]> => {
  const db = loadDb();
  return db.bikes;
};

export const getActiveRentals = async (): Promise<RentalType[]> => {
  const db = loadDb();
  return db.rentals
    .filter((rental) => !rental.is_returned)
    .map((rental) => withRelations(db, rental))
    .filter((rental): rental is RentalType => Boolean(rental));
};

export const getCompletedRentals = async (): Promise<RentalType[]> => {
  const db = loadDb();
  return db.rentals
    .filter((rental) => rental.is_returned)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    .map((rental) => withRelations(db, rental))
    .filter((rental): rental is RentalType => Boolean(rental));
};

export const addBike = async (bike: {
  bike_id: string;
  model: string;
  hourly_rate: number;
  status?: BikeStatus;
}) => {
  const db = loadDb();
  const existing = db.bikes.find((item) => item.bike_id === bike.bike_id);
  if (existing) {
    throw new Error("Bike ID already exists");
  }

  db.bikes.push({
    bike_id: bike.bike_id,
    model: bike.model,
    hourly_rate: bike.hourly_rate,
    status: bike.status ?? "AVAILABLE",
    last_maintenance_date: new Date().toISOString(),
    notes: null,
  });

  saveDb(db);
};

const findOrCreateCustomer = (db: LocalDatabase, name: string): CustomerType => {
  const existing = db.customers.find((customer) => customer.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return existing;
  }

  const customer: CustomerType = {
    id: db.counters.customerId++,
    name,
  };
  db.customers.push(customer);
  return customer;
};

export const startRental = async (customerName: string, bikeId: string) => {
  const db = loadDb();
  const bike = db.bikes.find((item) => item.bike_id === bikeId);

  if (!bike) {
    throw new Error("Bike not found");
  }

  if (bike.status !== "AVAILABLE") {
    throw new Error("Bike is not available");
  }

  const customer = findOrCreateCustomer(db, customerName);

  db.rentals.push({
    id: db.counters.rentalId++,
    customer_id: customer.id,
    bike_id: bikeId,
    start_time: new Date().toISOString(),
    is_returned: false,
    duration_hours: null,
    final_cost: null,
  });

  bike.status = "RENTED";
  saveDb(db);
};

export const getRentalById = async (id: number): Promise<RentalType | null> => {
  const db = loadDb();
  const rental = db.rentals.find((item) => item.id === id);
  if (!rental) {
    return null;
  }

  return withRelations(db, rental);
};

export const endRental = async (id: number, duration: number): Promise<RentalType> => {
  const db = loadDb();
  const rental = db.rentals.find((item) => item.id === id);

  if (!rental) {
    throw new Error("Rental not found");
  }

  const bike = db.bikes.find((item) => item.bike_id === rental.bike_id);
  const customer = db.customers.find((item) => item.id === rental.customer_id);

  if (!bike || !customer) {
    throw new Error("Rental data is incomplete");
  }

  const finalCost = bike.hourly_rate * duration;

  rental.is_returned = true;
  rental.duration_hours = duration;
  rental.final_cost = finalCost;
  bike.status = "AVAILABLE";

  saveDb(db);

  return {
    ...rental,
    customers: customer,
    bikes: bike,
  };
};

export const updateBikeStatus = async (bikeId: string, status: BikeStatus) => {
  const db = loadDb();
  const bike = db.bikes.find((item) => item.bike_id === bikeId);

  if (!bike) {
    throw new Error("Bike not found");
  }

  bike.status = status;
  saveDb(db);
};
