'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ServerCard({ server }: { server: any }) {

  const { data, error, isLoading } = useSWR(
    `${server.url}/api/monitor?key=${server.apiKey}`, 
    fetcher, 
    { refreshInterval: 5000 }
  );

  if (isLoading) return <div className="bg-gray-800 p-6 rounded animate-pulse">Loading {server.name}...</div>;
  if (error) return <div className="bg-red-900 p-6 rounded">Error connecting to {server.name}</div>;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
      <h2 className="text-xl font-bold text-blue-400 mb-2">{server.name}</h2>
      <p className="text-sm text-gray-400 mb-4">{data.hostname} - {data.platform}</p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-1">
            <span>CPU Load</span>
            <span>{data.cpu}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${data.cpu}%` }}></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span>RAM Usage</span>
            <span>{data.mem.percent}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${data.mem.percent}%` }}></div>
          </div>
        </div>
        
        <div className="mt-4">
            <h3 className="text-sm font-semibold mb-1">Latest Logs:</h3>
            <pre className="text-xs bg-black p-2 rounded h-32 overflow-y-auto text-green-500 whitespace-pre-wrap">
                {data.logs}
            </pre>
        </div>
      </div>
    </div>
  );
}