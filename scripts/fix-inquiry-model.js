const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/models/Inquiry.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the interface to include all fields
content = content.replace(
  /interface InquiryCreationAttributes extends Optional<InquiryAttributes, 'id' \| 'phone' \| 'ipAddress' \| 'userAgent' \| 'assignedTo' \| 'adminNotes' \| 'createdAt' \| 'updatedAt'> {}/,
  `interface InquiryCreationAttributes extends Optional<InquiryAttributes, 'id' | 'phone' | 'ipAddress' | 'userAgent' | 'assignedTo' | 'adminNotes' | 'source' | 'resolvedAt' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}`
);

// Fix class properties
content = content.replace(
  /public readonly createdAt!: Date;\n  public readonly updatedAt!: Date;/,
  `public source?: string;
  public resolvedAt?: number;
  public readonly createdAt!: number;
  public readonly updatedAt!: number;
  public isDeleted!: number;
  public deletedAt!: number | null;`
);

// Add missing fields to schema
const fieldsToAdd = `      source: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      resolvedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },`;

content = content.replace(
  /adminNotes: {\n\s+type: DataTypes\.TEXT,\n\s+allowNull: true,\n\s+},/,
  `adminNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
${fieldsToAdd}`
);

// Fix timestamps config and add hooks
content = content.replace(
  /{\n\s+sequelize,\n\s+tableName: 'wd_inquiries',\n\s+timestamps: true,\n\s+}/,
  `{
      sequelize,
      tableName: 'wd_inquiries',
      timestamps: false,
      hooks: {
        beforeCreate: async (inquiry: Inquiry) => {
          const now = Math.floor(Date.now() / 1000);
          inquiry.createdAt = now;
          inquiry.updatedAt = now;
          inquiry.isDeleted = 0;
          inquiry.deletedAt = null;
        },
        beforeUpdate: async (inquiry: Inquiry) => {
          inquiry.updatedAt = Math.floor(Date.now() / 1000);
        },
      },
    }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Inquiry model fixed');
