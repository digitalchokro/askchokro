import { describe, it, expect } from 'vitest';
import { MysqlAdapter } from './index';

describe('MysqlAdapter', () => {
  it('instantiates correctly with connection string', () => {
    const adapter = new MysqlAdapter({ connectionString: 'mysql://user:pass@localhost:3306/db' });
    expect(adapter).toBeInstanceOf(MysqlAdapter);
  });
});
