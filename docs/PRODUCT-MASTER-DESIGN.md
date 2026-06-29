# WorkDesk24 Product Master Design

## Overview

The Product Master module is designed to support multiple industries such as:

* FMCG
* Pharma
* Electronics
* Manufacturing
* Apparel
* Distribution

The design uses a generic product structure with dynamic attributes and media support.

---

# Entity Relationship

```text
wd_products
    |
    +-- categoryId -> wd_product_categories.id
    |
    +-- brandId -> wd_product_brands.id
    |
    +-- uomId -> wd_uom_master.id
    |
    +-- wd_product_attributes.productId
    |
    +-- wd_product_media.productId
```

---

# Table: wd_uom_master

Stores Units of Measurement.

## Columns

| Column      |
| ----------- |
| id          |
| hostId      |
| uomCode     |
| uomName     |
| description |
| isEnabled   |
| isDeleted   |
| createdAt   |
| updatedAt   |
| deletedAt   |

## Example Data

| id | hostId | uomCode | uomName    |
| -- | ------ | ------- | ---------- |
| 1  | NULL   | PCS     | Pieces     |
| 2  | NULL   | KG      | Kilogram   |
| 3  | NULL   | GM      | Gram       |
| 4  | NULL   | ML      | Milliliter |
| 5  | NULL   | LTR     | Liter      |

---

# Table: wd_product_categories

Stores product categories and sub-categories.

## Columns

| Column           |
| ---------------- |
| id               |
| hostId           |
| categoryName     |
| parentCategoryId |
| description      |
| displayOrder     |
| isEnabled        |
| isDeleted        |
| createdAt        |
| updatedAt        |
| deletedAt        |

## Example Data

| id | categoryName | parentCategoryId |
| -- | ------------ | ---------------- |
| 1  | FMCG         | NULL             |
| 2  | Beverages    | 1                |
| 3  | Soft Drinks  | 2                |

Hierarchy:

```text
FMCG
 └─ Beverages
      └─ Soft Drinks
```

---

# Table: wd_product_brands

Stores brands.

## Columns

| Column      |
| ----------- |
| id          |
| hostId      |
| brandName   |
| description |
| isEnabled   |
| isDeleted   |
| createdAt   |
| updatedAt   |
| deletedAt   |

## Example Data

| id | brandName |
| -- | --------- |
| 1  | Pepsi     |
| 2  | Coca Cola |
| 3  | Nestle    |

---

# Table: wd_products

Stores product master information.

## Columns

| Column        |
| ------------- |
| id            |
| hostId        |
| productCode   |
| productName   |
| shortName     |
| description   |
| categoryId    |
| brandId       |
| uomId         |
| sku           |
| barcode       |
| hsnCode       |
| purchasePrice |
| sellingPrice  |
| mrp           |
| taxPercentage |
| isEnabled     |
| isDeleted     |
| createdAt     |
| updatedAt     |
| deletedAt     |

## Example Product

### Pepsi 500ml

| Field         | Value                         |
| ------------- | ----------------------------- |
| id            | 101                           |
| hostId        | 1                             |
| productCode   | PROD0001                      |
| productName   | Pepsi 500ml                   |
| shortName     | Pepsi                         |
| description   | Pepsi Soft Drink Bottle 500ml |
| categoryId    | 3                             |
| brandId       | 1                             |
| uomId         | 1                             |
| sku           | PEP-500                       |
| barcode       | 8901234567890                 |
| hsnCode       | 22021010                      |
| purchasePrice | 15.00                         |
| sellingPrice  | 18.00                         |
| mrp           | 20.00                         |
| taxPercentage | 12.00                         |

---

# Table: wd_product_attributes

Stores dynamic product attributes.

## Columns

| Column         |
| -------------- |
| id             |
| hostId         |
| productId      |
| attributeGroup |
| attributeName  |
| attributeValue |
| attributeType  |
| attributeUomId |
| displayOrder   |
| isEnabled      |
| isDeleted      |
| createdAt      |
| updatedAt      |
| deletedAt      |

## attributeType Enum

```text
TEXT
NUMBER
DECIMAL
DATE
BOOLEAN
JSON
```

## Example Data

### Pepsi 500ml

| attributeGroup | attributeName | attributeValue | attributeType | attributeUomId |
| -------------- | ------------- | -------------- | ------------- | -------------- |
| GENERAL        | Flavor        | Cola           | TEXT          | NULL           |
| GENERAL        | Volume        | 500            | NUMBER        | 4              |
| PACKAGING      | Weight        | 550            | NUMBER        | 3              |
| COMPLIANCE     | FSSAI Number  | 123456789      | TEXT          | NULL           |

### Samsung TV

| attributeGroup | attributeName | attributeValue | attributeType |
| -------------- | ------------- | -------------- | ------------- |
| TECHNICAL      | Screen Size   | 55             | NUMBER        |
| TECHNICAL      | Voltage       | 220            | NUMBER        |
| SALES          | Warranty      | 2 Years        | TEXT          |

### Apparel

| attributeGroup | attributeName | attributeValue | attributeType |
| -------------- | ------------- | -------------- | ------------- |
| GENERAL        | Color         | Blue           | TEXT          |
| GENERAL        | Size          | XL             | TEXT          |
| GENERAL        | Fabric        | Cotton         | TEXT          |

---

# Table: wd_product_media

Stores images, videos and documents.

## Columns

| Column       |
| ------------ |
| id           |
| hostId       |
| productId    |
| mediaType    |
| mediaUrl     |
| thumbnailUrl |
| publicId     |
| fileName     |
| mimeType     |
| fileSize     |
| isPrimary    |
| displayOrder |
| isEnabled    |
| isDeleted    |
| createdAt    |
| updatedAt    |
| deletedAt    |

## mediaType Enum

```text
IMAGE
VIDEO
PDF
DOCUMENT
BROCHURE
CERTIFICATE
LABEL
MANUAL
```

## Example Data

### Product Images

| mediaType | fileName       |
| --------- | -------------- |
| IMAGE     | front-view.jpg |
| IMAGE     | side-view.jpg  |

### Product Video

| mediaType | fileName |
| --------- | -------- |
| VIDEO     | demo.mp4 |

### Product Brochure

| mediaType | fileName     |
| --------- | ------------ |
| PDF       | brochure.pdf |

### Sample Record

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| productId    | 101                                                          |
| mediaType    | IMAGE                                                        |
| mediaUrl     | https://cdn.workdesk24.com/products/101/front-view.jpg       |
| thumbnailUrl | https://cdn.workdesk24.com/products/101/thumb-front-view.jpg |
| publicId     | products/101/front-view                                      |
| fileName     | front-view.jpg                                               |
| mimeType     | image/jpeg                                                   |
| fileSize     | 524288                                                       |
| isPrimary    | true                                                         |
| displayOrder | 1                                                            |

---

# Product Creation Flow

## Step 1

Create Category

```text
FMCG
  -> Beverages
      -> Soft Drinks
```

## Step 2

Create Brand

```text
Pepsi
```

## Step 3

Create Product

```text
Pepsi 500ml
```

## Step 4

Add Attributes

```text
Flavor = Cola
Volume = 500 ML
Weight = 550 GM
```

## Step 5

Upload Media

```text
Front Image
Back Image
Demo Video
Brochure PDF
```

---

# Recommended Constraints

## wd_uom_master

```text
UNIQUE(hostId, uomCode)
```

## wd_product_categories

```text
UNIQUE(hostId, parentCategoryId, categoryName)
```

## wd_product_brands

```text
UNIQUE(hostId, brandName)
```

## wd_products

```text
UNIQUE(hostId, productCode)
```

Optional:

```text
UNIQUE(hostId, sku)
```

---

# Final Notes

* hostId should be NULL for global UOM records.
* fileSize should always be stored in bytes.
* barcode should store barcode value, not image.
* thumbnailUrl should be nullable.
* attributeUomId should be nullable.
* Prices should use DECIMAL(12,2).
* Tax percentage should use DECIMAL(5,2).
* Product media should be uploaded to cloud storage (Cloudinary/S3) and only URLs should be stored in the database.
* Product attributes allow industry-specific customization without changing database schema.