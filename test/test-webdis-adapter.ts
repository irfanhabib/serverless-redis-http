import { Redis } from '@upstash/redis';
import { WebdisRequester, createWebdisRedis } from './webdis-adapter';

// Two equivalent ways to construct the client — pick either.
const redis: Redis = createWebdisRedis({ url: 'http://localhost:7379' });
// const redis = new Redis(new WebdisRequester({ url: 'http://localhost:7379' }));

async function testWebdisAdapter() {
  console.log('Testing @upstash/redis over WebdisRequester transport');
  console.log('='.repeat(60));

  try {
    console.log('\n1. ping');
    console.log('   ->', await redis.ping());

    console.log('\n2. set / get');
    await redis.set('adapter:test', 'Hello from adapter!');
    console.log('   ->', await redis.get('adapter:test'));

    console.log('\n3. del');
    await redis.del('adapter:test');
    console.log('   ->', await redis.get('adapter:test'));

    console.log('\n4. list ops');
    await redis.del('adapter:list');
    await redis.lpush('adapter:list', 'item1', 'item2', 'item3');
    console.log('   lrange ->', await redis.lrange('adapter:list', 0, -1));
    console.log('   llen   ->', await redis.llen('adapter:list'));
    await redis.del('adapter:list');

    console.log('\n5. mget');
    await redis.set('adapter:a', 'value-a');
    await redis.set('adapter:b', 'value-b');
    await redis.set('adapter:c', 'value-c');
    console.log('   ->', await redis.mget('adapter:a', 'adapter:b', 'adapter:c'));
    await redis.del('adapter:a', 'adapter:b', 'adapter:c');

    console.log('\n6. hash ops');
    await redis.del('adapter:hash');
    await redis.hset('adapter:hash', { field1: 'value1', field2: 'value2' });
    console.log('   ->', await redis.hgetall('adapter:hash'));
    await redis.del('adapter:hash');

    console.log('\n7. scan');
    await redis.set('scan:test:1', 'val1');
    await redis.set('scan:test:2', 'val2');
    await redis.set('scan:test:3', 'val3');
    const [cursor, keys] = await redis.scan(0, { match: 'scan:test:*', count: 10 });
    console.log('   cursor:', cursor, 'keys:', keys);
    if (keys.length) await redis.del(...keys);

    console.log('\n8. counter');
    await redis.set('adapter:counter', 10);
    await redis.incr('adapter:counter');
    const afterIncr = await redis.incr('adapter:counter');
    const afterDecr = await redis.decr('adapter:counter');
    console.log('   after 2x incr:', afterIncr, 'after 1x decr:', afterDecr);
    await redis.del('adapter:counter');

    console.log('\n' + '='.repeat(60));
    console.log('All transport-adapter tests passed.');
  } catch (error) {
    console.error('\nError:', error);
  }
}

testWebdisAdapter();
