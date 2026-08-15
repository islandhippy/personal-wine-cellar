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

Migration `202608150004_private_wine_label_storage.sql` creates the private
`wine-labels` Storage bucket. It accepts JPEG, PNG, WebP, HEIC and HEIF images
up to 15 MB. Storage policies require every object path to begin with the
authenticated owner's user ID, so photographs are not public and cannot be
read or changed by another account.

Use this object-path convention when image upload is implemented:

```text
<user-id>/<wine-id>/<front-or-back>-<uuid>.<extension>
```

The corresponding path is stored in `public.wine_images.storage_path`. Export
can therefore enumerate the metadata and download the original photographs
independently of the application.
