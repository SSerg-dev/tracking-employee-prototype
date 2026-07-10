const test = require('node:test');
const assert = require('node:assert/strict');

const { RequestStatus, EmployeeRequest } = require('../src/domain');

test('allows request status to move from New to In Progress', () => {
  const request = new EmployeeRequest({ id: 1, status: RequestStatus.NEW });

  request.changeStatus(RequestStatus.IN_PROGRESS);

  assert.equal(request.status, RequestStatus.IN_PROGRESS);
});

test('rejects request status jump from New directly to Done', () => {
  const request = new EmployeeRequest({ id: 1, status: RequestStatus.NEW });

  assert.throws(
    () => request.changeStatus(RequestStatus.DONE),
    /Invalid status transition/
  );
  assert.equal(request.status, RequestStatus.NEW);
});

test('allows request status to move from In Progress to Done', () => {
  const request = new EmployeeRequest({ id: 1, status: RequestStatus.IN_PROGRESS });

  request.changeStatus(RequestStatus.DONE);

  assert.equal(request.status, RequestStatus.DONE);
});

test('rejects assignee change when employee id is missing', () => {
  const request = new EmployeeRequest({ id: 1, assigneeId: 10, status: RequestStatus.NEW });

  assert.throws(() => request.changeAssignee(undefined), /Assignee is required/);
  assert.equal(request.assigneeId, 10);
});
