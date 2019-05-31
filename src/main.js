const axios = require('axios')
const redis = require('redis')
const Influx = require('influx')

require('dotenv').config()

const client = redis.createClient()
const {promisify} = require('util');
client.getAsync = promisify(client.get).bind(client);
const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: 'networkdb',
  schema: [
    {
      measurement: 'bandwidth',
      fields: {
        byte_v4_in: Influx.FieldType.FLOAT,
        byte_v6_in: Influx.FieldType.FLOAT,
        byte_v4_out: Influx.FieldType.FLOAT,
        byte_v6_out: Influx.FieldType.FLOAT
      },
      tags: []
    },
    {
      measurement: 'packet',
      fields: {
        pkt_v4_in: Influx.FieldType.FLOAT,
        pkt_v6_in: Influx.FieldType.FLOAT,
        pkt_v4_out: Influx.FieldType.FLOAT,
        pkt_v6_out: Influx.FieldType.FLOAT
      },
      tags: []
    },
    {
      measurement: 'flow',
      fields: {
        v4: Influx.FieldType.FLOAT,
        v6: Influx.FieldType.FLOAT,
        icmp_v4: Influx.FieldType.FLOAT,
        icmp_v6: Influx.FieldType.FLOAT,
        tcp_v4: Influx.FieldType.FLOAT,
        tcp_v6: Influx.FieldType.FLOAT,
        udp_v4: Influx.FieldType.FLOAT,
        udp_v6: Influx.FieldType.FLOAT,
        other_v4: Influx.FieldType.FLOAT,
        other_v6: Influx.FieldType.FLOAT,
        http_in: Influx.FieldType.FLOAT,
        http_out: Influx.FieldType.FLOAT,
      },
      tags: []
    },
    {
      measurement: 'login',
      fields: {
        login_pure_v4: Influx.FieldType.FLOAT,
        login_pure_v6: Influx.FieldType.FLOAT,
        login_dual_stacks: Influx.FieldType.FLOAT,
        logout_pure_v4: Influx.FieldType.FLOAT,
        logout_pure_v6: Influx.FieldType.FLOAT,
        logout_dual_stacks: Influx.FieldType.FLOAT
      },
      tags: []
    },
    {
      measurement: 'stat',
      fields: {
        active_devices: Influx.FieldType.FLOAT,
        active_users: Influx.FieldType.FLOAT,
        active_dual_stacks: Influx.FieldType.FLOAT,
        active_pure_v4: Influx.FieldType.FLOAT,
        active_pure_v6: Influx.FieldType.FLOAT,
        active_ip_all: Influx.FieldType.FLOAT,
        active_flow_v4: Influx.FieldType.FLOAT,
        active_flow_v6: Influx.FieldType.FLOAT,
        active_flow_all: Influx.FieldType.FLOAT
      },
      tags: []
    }
  ]
})

let bandwidthOldFallback = {
  byte_v4_in: 0,
  byte_v6_in: 0,
  byte_v4_out: 0,
  byte_v6_out: 0
}
let packetOldFallback = {
  pkt_v4_in: 0,
  pkt_v6_in: 0,
  pkt_v4_out: 0,
  pkt_v6_out: 0
}
let flowOldFallback = {
  v4: 0,
  v6: 0,
  icmp_v4: 0,
  icmp_v6: 0,
  tcp_v4: 0,
  tcp_v6: 0,
  udp_v4: 0,
  udp_v6: 0,
  other_v4: 0,
  other_v6: 0,
  http_in: 0,
  http_out: 0,
}
let loginOldFallback = {
  login_pure_v4: 0,
  login_pure_v6: 0,
  login_dual_stacks: 0,
  logout_pure_v4: 0,
  logout_pure_v6: 0,
  logout_dual_stacks: 0
}

const main = async () => {
  try {
    const [ sessionSummary, flowSummary, statSummary ] = await Promise.all([
      axios.get('http://192.168.253.61:9095/getSessionSummary'),
      axios.get('http://192.168.253.61:9095/getFlowSummary'),
      axios.get('http://192.168.253.61:9095/getStatSummary')
    ])

    let stat = {
      active_devices: sessionSummary.data.active_devices,
      active_users: sessionSummary.data.active_users,
      active_dual_stacks: sessionSummary.data.active_dual_stacks,
      active_pure_v4: sessionSummary.data.active_pure_v4,
      active_pure_v6: sessionSummary.data.active_pure_v6,
      active_ip_all: sessionSummary.data.active_pure_v4 
        + sessionSummary.data.active_pure_v6
        + 2 * sessionSummary.data.active_dual_stacks,
      active_flow_v4: flowSummary.data.active_v4,
      active_flow_v6: flowSummary.data.active_v6,
      active_flow_all: flowSummary.data.active_v4 + flowSummary.data.active_v6
    }
    client.set('stat', JSON.stringify(stat), redis.print)

    let bandwidthOld = await client.getAsync('bandwidth-old')
    if (bandwidthOld) {
      bandwidthOld = JSON.parse(bandwidthOld)
    } else {
      bandwidthOld = bandwidthOldFallback
    }
    let bandwidthNew = {
      byte_v4_in: statSummary.data.byte_v4_in,
      byte_v6_in: statSummary.data.byte_v6_in,
      byte_v4_out: statSummary.data.byte_v4_out,
      byte_v6_out: statSummary.data.byte_v6_out
    }
    let bandwidthRate = {
      byte_v4_in: (bandwidthNew.byte_v4_in - bandwidthOld.byte_v4_in) / 60,
      byte_v6_in: (bandwidthNew.byte_v6_in - bandwidthOld.byte_v6_in) / 60,
      byte_v4_out: (bandwidthNew.byte_v4_out - bandwidthOld.byte_v4_out) / 60,
      byte_v6_out: (bandwidthNew.byte_v6_out - bandwidthOld.byte_v6_out) / 60
    }
    bandwidthOld = bandwidthNew
    client.set('bandwidth-old', JSON.stringify(bandwidthOld), redis.print)
    client.set('bandwidth', JSON.stringify(bandwidthRate), redis.print)

    let packetOld = await client.getAsync('packet-old')
    if (packetOld) {
      packetOld = JSON.parse(packetOld)
    } else {
      packetOld = packetOldFallback
    }
    let packetNew = {
      pkt_v4_in: statSummary.data.pkt_v4_in,
      pkt_v6_in: statSummary.data.pkt_v6_in,
      pkt_v4_out: statSummary.data.pkt_v4_out,
      pkt_v6_out: statSummary.data.pkt_v6_out
    }
    let packetRate = {
      pkt_v4_in: (packetNew.pkt_v4_in - packetOld.pkt_v4_in) / 60,
      pkt_v6_in: (packetNew.pkt_v6_in - packetOld.pkt_v6_in) / 60,
      pkt_v4_out: (packetNew.pkt_v4_out - packetOld.pkt_v4_out) / 60,
      pkt_v6_out: (packetNew.pkt_v6_out - packetOld.pkt_v6_out) / 60
    }
    packetOld = packetNew
    client.set('packet-old', JSON.stringify(packetOld), redis.print)
    client.set('packet', JSON.stringify(packetRate), redis.print)

    let flowOld = await client.getAsync('flow-old')
    if (flowOld) {
      flowOld = JSON.parse(flowOld)
    } else {
      flowOld = flowOldFallback
    }
    let flowNew = {
      v4: flowSummary.data.v4,
      v6: flowSummary.data.v6,
      icmp_v4: flowSummary.data.icmp_v4,
      icmp_v6: flowSummary.data.icmp_v6,
      tcp_v4: flowSummary.data.tcp_v4,
      tcp_v6: flowSummary.data.tcp_v6,
      udp_v4: flowSummary.data.udp_v4,
      udp_v6: flowSummary.data.udp_v6,
      other_v4: flowSummary.data.other_v4,
      other_v6: flowSummary.data.other_v6,
      http_in: flowSummary.data.http_in,
      http_out: flowSummary.data.http_out,
    }
    let flowRate = {
      v4: (flowNew.v4 - flowOld.v4) / 60,
      v6: (flowNew.v6 - flowOld.v6) / 60,
      icmp_v4: (flowNew.icmp_v4 - flowOld.icmp_v4) / 60,
      icmp_v6: (flowNew.icmp_v6 - flowOld.icmp_v6) / 60,
      tcp_v4: (flowNew.tcp_v4 - flowOld.tcp_v4) / 60,
      tcp_v6: (flowNew.tcp_v6 - flowOld.tcp_v6) / 60,
      udp_v4: (flowNew.udp_v4 - flowOld.udp_v4) / 60,
      udp_v6: (flowNew.udp_v6 - flowOld.udp_v6) / 60,
      other_v4: (flowNew.other_v4 - flowOld.other_v4) / 60,
      other_v6: (flowNew.other_v6 - flowOld.other_v6) / 60,
      http_in: (flowNew.http_in - flowOld.http_in) / 60,
      http_out: (flowNew.http_out - flowOld.http_out) / 60
    }
    flowOld = flowNew
    client.set('flow-old', JSON.stringify(flowOld), redis.print)
    client.set('flow', JSON.stringify(flowRate), redis.print)

    let loginOld = await client.getAsync('login-old')
    if (loginOld) {
      loginOld = JSON.parse(loginOld)
    } else {
      loginOld = loginOldFallback
    }

    let loginNew = {
      login_pure_v4: sessionSummary.data.login_pure_v4,
      login_pure_v6: sessionSummary.data.login_pure_v6,
      login_dual_stacks: sessionSummary.data.login_dual_stacks,
      logout_pure_v4: sessionSummary.data.logout_pure_v4,
      logout_pure_v6: sessionSummary.data.logout_pure_v6,
      logout_dual_stacks: sessionSummary.data.logout_dual_stacks
    }
    let loginRate = {
      login_pure_v4: (loginNew.login_pure_v4 - loginOld.login_pure_v4) / 60,
      login_pure_v6: (loginNew.login_pure_v6 - loginOld.login_pure_v6) / 60,
      login_dual_stacks: (loginNew.login_dual_stacks - loginOld.login_dual_stacks) / 60,
      logout_pure_v4: (loginNew.logout_pure_v4 - loginOld.logout_pure_v4) / 60,
      logout_pure_v6: (loginNew.logout_pure_v6 - loginOld.logout_pure_v6) / 60,
      logout_dual_stacks: (loginNew.logout_dual_stacks - loginOld.logout_dual_stacks) / 60
    }
    loginOld = loginNew
    client.set('login-old', JSON.stringify(loginOld), redis.print)
    client.set('login', JSON.stringify(loginRate), redis.print)

    influx.writePoints([
      {
        measurement: 'bandwidth',
        fields: bandwidthRate
      },
      {
        measurement: 'packet',
        fields: packetRate
      },
      {
        measurement: 'flow',
        fields: flowRate
      },
      {
        measurement: 'login',
        fields: loginRate
      },
      {
        measurement: 'stat',
        fields: stat
      }
    ])

  } catch (error) {
    console.log(error)
  }
}

module.exports = main
