import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';
import { CommonUtil } from '../../../shared/utils/common.util';
import { logger } from '../../../config/database';
import notificationFacade from '../NotificationFacade';
import taskRepository, { TaskRepository } from '../../task/repositories/task.repository';
import userRepository, { UserRepository } from '../../auth/repositories/user.repository';
import pushNotificationsRepository from '../repositories/push.notifications.repository';
import { NotificationAction, NotificationType, PushMessage } from '../channels/push/types/push.types';

type TaskNotificationEvent = 'TASK_CREATED' | 'TASK_REASSIGNED';

interface TaskNotificationDetails {
  id: number;
  hostId: number;
  title?: string | null;
  taskNumber?: string | number | null;
  assignedToUserId?: number | null;
}

interface TaskNotificationRecipient {
  id: number;
  deviceId: string;
  fcmToken: string;
}

export class TaskNotificationService {
  constructor(
    private readonly tasks: Pick<TaskRepository, 'findAssignee'> = taskRepository,
    private readonly users: Pick<UserRepository, 'findActiveDevicesByUser'> = userRepository,
    private readonly notifications: typeof notificationFacade = notificationFacade,
    private readonly pushLogs: typeof pushNotificationsRepository = pushNotificationsRepository
  ) {}

  async notifyTaskCreated(task: TaskNotificationDetails): Promise<void> {
    if (!task.assignedToUserId) return;

    const title = 'New Task Assigned';
    const taskTitle = this.taskTitle(task);
    const taskNumber = this.taskNumber(task);
    const body = taskNumber
      ? `You have been assigned Task #${taskNumber}: ${taskTitle}.`
      : `You have been assigned a task: ${taskTitle}.`;

    await this.notifyUser(task, Number(task.assignedToUserId), 'TASK_CREATED', title, body);
  }

  async notifyTaskReassigned(
    task: TaskNotificationDetails,
    previousAssigneeId: number | null,
    newAssigneeId: number | null
  ): Promise<void> {
    if (!newAssigneeId || previousAssigneeId === newAssigneeId) return;

    const taskTitle = this.taskTitle(task);
    const taskNumber = this.taskNumber(task);
    const reference = taskNumber ? `Task #${taskNumber}: ${taskTitle}` : `Task ${taskTitle}`;
    const deliveries: Promise<void>[] = [];

    if (previousAssigneeId) {
      deliveries.push(
        this.notifyUser(
          task,
          previousAssigneeId,
          'TASK_REASSIGNED',
          'Task Reassigned',
          `${reference} has been reassigned to another team member.`
        )
      );
    }

    deliveries.push(
      this.notifyUser(
        task,
        newAssigneeId,
        'TASK_REASSIGNED',
        'Task Assigned to You',
        taskNumber
          ? `You have been assigned Task #${taskNumber}: ${taskTitle}.`
          : `You have been assigned a task: ${taskTitle}.`
      )
    );

    await Promise.all(deliveries);
  }

  private async notifyUser(
    task: TaskNotificationDetails,
    userId: number,
    event: TaskNotificationEvent,
    title: string,
    body: string
  ): Promise<void> {
    const context = { hostId: task.hostId, taskId: task.id, recipientUserId: userId, event };

    try {
      const eligibleUser = await this.tasks.findAssignee(task.hostId, userId);
      if (!eligibleUser) {
        logger.warn('Skipping task push notification for an ineligible recipient', context);
        return;
      }

      const deviceRows = await this.users.findActiveDevicesByUser(task.hostId, userId);
      console.log('##################### Active devices for user:', deviceRows);
      const uniqueDevices = new Map<string, TaskNotificationRecipient>();
      for (const device of deviceRows) {
        const token = device.fcmToken?.trim();
        if (token && !uniqueDevices.has(token)) {
          uniqueDevices.set(token, {
            id: device.id,
            deviceId: device.deviceId,
            fcmToken: token,
          });
        }
      }
      console.log('##################### Unique devices for user:', Array.from(uniqueDevices.values()));

      if (uniqueDevices.size === 0) {
        logger.warn('Skipping task push notification because no active device token exists', context);
        return;
      }

      const notificationId = CommonUtil.generateUUID();
      const data: Record<string, string> = {
        notificationId,
        notificationType: NotificationType.TASK,
        action: NotificationAction.OPEN_TASK_DETAILS,
        event,
        taskId: String(task.id),
        title,
        body,
        timestamp: DateTimeFormatUtil.getCurrentUnixTime().toString(),
      };
      const taskNumber = this.taskNumber(task);
      if (taskNumber) data.taskNumber = taskNumber;

      await Promise.all(
        Array.from(uniqueDevices.values(), (device) =>
          this.sendToDevice(task, userId, device, event, notificationId, data)
        )
      );
    } catch (_error) {
      logger.error('Failed to prepare task push notification', context);
    }
  }

  private async sendToDevice(
    task: TaskNotificationDetails,
    userId: number,
    device: TaskNotificationRecipient,
    event: TaskNotificationEvent,
    notificationId: string,
    data: Record<string, string>
  ): Promise<void> {
    let success = false;
    let messageId: string | undefined;
    let provider: string | undefined;

    try {
      const message: PushMessage = { token: device.fcmToken, data };
      const result = await this.notifications.send({ channel: 'PUSH', payload: message });
      success = result.success;
      messageId = result.messageId;
      provider = result.provider;
    } catch (_error) {
      success = false;
    }

    if (!success) {
      logger.error('Task push delivery failed', {
        hostId: task.hostId,
        taskId: task.id,
        recipientUserId: userId,
        deviceId: device.deviceId,
        event,
      });
    }

    try {
      await this.pushLogs.savePushNotification({
        hostId: task.hostId,
        userId,
        deviceId: device.deviceId,
        fcmToken: device.fcmToken,
        notificationId,
        notificationType: NotificationType.TASK,
        action: NotificationAction.OPEN_TASK_DETAILS,
        status: success ? 'SENT' : 'FAILED',
        providerMessageId: messageId || null,
        provider: provider || null,
        failureReason: success ? null : 'Push delivery failed',
        sentAt: success ? DateTimeFormatUtil.getCurrentUnixTime() : null,
        payload: data,
        deliveryMode: 'VISIBLE',
        priority: 'HIGH',
      });
    } catch (_error) {
      logger.error('Failed to save task push delivery log', {
        hostId: task.hostId,
        taskId: task.id,
        recipientUserId: userId,
        deviceId: device.deviceId,
        event,
      });
    }
  }

  private taskTitle(task: TaskNotificationDetails): string {
    return typeof task.title === 'string' && task.title.trim() ? task.title.trim() : 'Untitled task';
  }

  private taskNumber(task: TaskNotificationDetails): string | null {
    if (typeof task.taskNumber === 'number' && Number.isFinite(task.taskNumber)) {
      return String(task.taskNumber);
    }
    if (typeof task.taskNumber === 'string' && task.taskNumber.trim()) {
      return task.taskNumber.trim();
    }
    return null;
  }
}

export default new TaskNotificationService();
