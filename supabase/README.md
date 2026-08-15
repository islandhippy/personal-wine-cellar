# Database migrations

These migrations define the Personal Wine Cellar database in the user-owned Supabase project.

They are deliberately not applied automatically. Applying them changes the live database and should happen only after the project connection and authentication configuration have been checked.

## Migration order

1. `202608150001_core_schema.sql` creates the tables, constraints, indexes and timestamp handling.
2. `202608150002_inventory_functions.sql` creates atomic operations for adding a wine, adding bottles, drinking one and making a manual correction.
3. `202608150003_auth_and_rls.sql` creates the sole-user profile, six default shelves and private row-level access policies.

## Important rules encoded in the database

- A wine represents identical bottles of one vintage and size.
- Bottle size is either 750 ml (default) or 375 ml.
- Prices are optional GBP prices per bottle, stored as pennies.
- Quantity cannot fall below zero.
- Normal quantity changes must create an inventory transaction.
- Drinking one creates both a drinking event and a matching transaction.
- Wines and their history remain after the final bottle is consumed.
- Each authenticated user can access only their own data.
- New accounts receive Shelf 1 through Shelf 6 in top-to-bottom order.

The separate private Storage bucket and its policies will be added during the secure-image-storage step.
