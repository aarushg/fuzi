# FUZI CRM CSV Templates

Use these files to collect customer data for FUZI CRM entry/import.

- `crm_customer_import_master.csv`: best all-in-one customer recapture file for old CRM data. Includes install date, included 1-year service, extra purchased service years, final service expiry, AMC summary, unit, and assigned engineer.
- `crm_customers_template.csv`: main CRM customer/account record.
- `crm_site_visits_template.csv`: elevator site measurement and requirement data. Fill `customer_id` after the CRM customer exists.
- `crm_sales_inquiries_template.csv`: new leads, enquiries, and follow-up pipeline data.
- `crm_service_amc_template.csv`: service, AMC, warranty, and installed lift/service details.
- `crm_service_history_import.csv`: one row per service visit/history record for each customer.
- `crm_import_mapping.csv`: header-to-platform-field mapping for import setup.

Guidelines:
- Keep dates as `YYYY-MM-DD`.
- Use `Y` or `N` for consent and yes/no fields.
- Use one row per customer, inquiry, site visit, or lift/service record.
- Leave `id` or `customer_id` blank when creating a brand-new CRM customer unless FUZI has already given that customer an ID.
- Do not rename headers unless the import mapping is updated.

Recommended import/linking flow:
1. Ask the customer to fill `external_customer_ref` with their own stable ID, such as old CRM ID, building code, or account number.
2. Import or enter rows from `crm_customer_import_master.csv` into FUZI Customers.
3. After FUZI assigns a 4-digit customer ID, write that value into `fuzi_customer_id` / `customer_id`.
4. Use the same `external_customer_ref` in `crm_site_visits_template.csv`, `crm_sales_inquiries_template.csv`, and `crm_service_history_import.csv` to connect old sheet rows to the new FUZI customer record.
5. For service contracts, `included_service_years` is normally `1`. `additional_service_years_purchased` is paid extra years after the included first year. `service_years_purchased` is total covered years from install date.
