export enum ActivityModule {
    ATTENDANCE = 'ATTENDANCE',
    DAYOVER = 'DAYOVER',
    VISIT = 'VISIT',
    ORDER = 'ORDER',
    PAYMENT = 'PAYMENT',
    FEEDBACK = 'FEEDBACK',
    IMAGE = 'IMAGE',
}

export const ACTIVITY_DETAILS = {    
    ATTENDANCE_MARKED: {
        module: ActivityModule.ATTENDANCE,
        description: '${employeeName} marked attendance at ${activityTime}.',
        url: '/reports/attendance',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    ATTENDANCE_MARKED_ON_TIME: {
        module: ActivityModule.ATTENDANCE,
        description: '${employeeName} marked attendance on time at ${activityTime}.',
        url: '/reports/attendance',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    ATTENDANCE_MARKED_LATE: {
        module: ActivityModule.ATTENDANCE,
        description: '${employeeName} marked attendance ${lateMinutes} minutes late at ${activityTime}.',
        url: '/reports/attendance',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    DAYOVER_MARKED: {
        module: ActivityModule.DAYOVER,
        description: '${employeeName} marked day over at ${activityTime}.',
        url: '/reports/attendance',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    DAYOVER_MARKED_EARLY: {
        module: ActivityModule.DAYOVER,
        description: '${employeeName} marked day over ${earlyMinutes} minutes early at ${activityTime}.',
        url: '/reports/attendance',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    DAYOVER_MARKED_LATE: {
        module: ActivityModule.DAYOVER,
        description: '${employeeName} marked day over ${lateMinutes} minutes late at ${activityTime}.',
        url: '/reports/attendance',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    VISIT_CHECKIN: {
        module: ActivityModule.VISIT,
        description: '${employeeName} visited ${customerName} at ${activityTime}.',
        url: '/reports/visits',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    ORDER_CREATED: {
        module: ActivityModule.ORDER,
        description: '${employeeName} created an order for ${customerName} of ${amount} at ${activityTime}.',
        url: '/reports/orders',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    PAYMENT_COLLECTED: {
        module: ActivityModule.PAYMENT,
        description: '${employeeName} collected ${amount} payment from ${customerName} at ${activityTime}.',
        url: '/reports/payments',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    FEEDBACK_SUBMITTED: {
        module: ActivityModule.FEEDBACK,
        description: '${employeeName} submitted feedback for ${customerName} at ${activityTime}.',
        url: '/reports/feedbacks',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    IMAGE_UPLOADED: {
        module: ActivityModule.IMAGE,
        description: '${employeeName} uploaded image(s) for ${customerName} at ${activityTime}.',
        url: '/reports/images',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
    VISIT_CHECKOUT: {
        module: ActivityModule.VISIT,
        description: '${employeeName} checked out from ${customerName} at ${activityTime}.',
        url: '/reports/visits',
        payload: {
            filter: {
                userId: '${userId}',
                reportTime: {
                    from: '${fromTime}',
                    to: '${toTime}'
                }
            }
        },
    },
};

export const ACTIVITY_DESCRIPTION_KEYS = Object.keys(ACTIVITY_DETAILS).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {} as Record<keyof typeof ACTIVITY_DETAILS, keyof typeof ACTIVITY_DETAILS>);