const RequestStatus = Object.freeze({
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  DONE: 'done'
});

const StatusLabels = Object.freeze({
  [RequestStatus.NEW]: 'Новая',
  [RequestStatus.IN_PROGRESS]: 'В работе',
  [RequestStatus.DONE]: 'Выполнена'
});

const AllowedTransitions = Object.freeze({
  [RequestStatus.NEW]: new Set([RequestStatus.IN_PROGRESS]),
  [RequestStatus.IN_PROGRESS]: new Set([RequestStatus.DONE]),
  [RequestStatus.DONE]: new Set([])
});

class Employee {
  constructor({ id, fullName, departmentId, departmentName, positionId, positionName }) {
    this.id = id;
    this.fullName = fullName;
    this.departmentId = departmentId;
    this.departmentName = departmentName;
    this.positionId = positionId;
    this.positionName = positionName;
  }
}

class EmployeeRequest {
  constructor({
    id,
    number,
    createdAt,
    authorId,
    assigneeId,
    description,
    dueDate,
    status = RequestStatus.NEW
  }) {
    this.id = id;
    this.number = number;
    this.createdAt = createdAt;
    this.authorId = authorId;
    this.assigneeId = assigneeId;
    this.description = description;
    this.dueDate = dueDate;
    this.status = status;
  }

  changeStatus(nextStatus) {
    if (!Object.values(RequestStatus).includes(nextStatus)) {
      throw new Error(`Unknown request status: ${nextStatus}`);
    }

    const allowed = AllowedTransitions[this.status] || new Set();
    if (!allowed.has(nextStatus)) {
      throw new Error(
        `Invalid status transition from ${StatusLabels[this.status]} to ${StatusLabels[nextStatus]}`
      );
    }

    this.status = nextStatus;
  }

  changeAssignee(nextAssigneeId) {
    if (!Number.isInteger(nextAssigneeId) || nextAssigneeId <= 0) {
      throw new Error('Assignee is required');
    }

    this.assigneeId = nextAssigneeId;
  }
}

module.exports = {
  AllowedTransitions,
  Employee,
  EmployeeRequest,
  RequestStatus,
  StatusLabels
};
