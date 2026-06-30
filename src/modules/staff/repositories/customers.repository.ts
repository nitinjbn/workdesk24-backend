import db, { Customer, CustomerMedia, CustomerAttribute, CustomerType } from '../../../models';

export class CustomerRepository {
  async getCustomers(payload) {
    const { hostId, userId } = payload;

    const query = {
      attributes: {
        exclude: ['id', 'customerTypeId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
        include: [
          [db.Sequelize.col('Customer.id'), 'customerId'],
          [db.Sequelize.col('customerTypeDetails.customerTypeName'), 'customerType']
        ]
      },
      where: {
        hostId: hostId,
        isDeleted:0,
        isEnabled: 1
      },
      include:[
        {
          attributes:[],
          model: CustomerType,
          where: {
            isDeleted: 0
          },
          as: "customerTypeDetails",
          required: true
        },
        {
          attributes: {
            exclude: ['id', 'hostId', 'customerId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: CustomerMedia,
          where: {
            isDeleted: 0,
            isEnabled: 1
          },
          as: "customerMedia",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        },
        {
          attributes: {
            exclude: ['id', 'hostId', 'customerId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: CustomerAttribute,
          where: {
            isDeleted: 0
          },
          as: "customerAttribute",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        }
      ],
      logging: console.log
    }

    const rows = await Customer.findAll(query as any);
    const customers = rows.map((customer:any) => {
      const data = customer.toJSON();
      data.customerAttribute = this.groupCustomerAttributes(data.customerAttribute);
      return data;
    });

    return customers;
  }

  private groupCustomerAttributes(attributes = []) {
    const groups = {};

    for (const attribute of attributes) {
      const group = attribute.attributeGroup || "General";

      if (!groups[group]) {
        groups[group] = [];
      }

      groups[group].push({
        attributeName: attribute.attributeName,
        attributeValue: attribute.attributeValue,
        attributeType: attribute.attributeType,
        attributeUomId: attribute.attributeUomId,
        sortOrder: attribute.sortOrder
      });
    }

    return Object.entries(groups).map(([groupName, attributes]) => ({
      groupName,
      attributes
    }));
  }
}

export default new CustomerRepository();